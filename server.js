// server.js – SuperBuzzer WebSocket Server (locale, LAN, Cloudflare)
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, promises as fsPromises } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const PORT = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

const SAVE_FILE = join(__dirname, 'superbuzzer_save.json');

// ─── Stato default ─────────────────────────────────────────
function defaultState() {
  return {
    game: {
      phase: 'idle',        // 'idle' | 'slide' | 'buzzer' | 'buzzed'
      isBuzzed: false,
      buzzedBy: null,
      buzzQueue: [],        // [{ id, name }, ...] – max 3 in coda
      wrongPlayers: [],     // id dei giocatori che hanno già sbagliato questa slide
      buzzedThisSlide: [],  // id dei giocatori che si sono già prenotati questa slide
      correctAnswerOrder: 0,
      currentSlide: null,
      settings: {
        hostPin: '1234',
        points1st: 3,
        points2nd: 2,
        points3rd: 1,
        penalty: 1,
      },
    },
    players: {},
  };
}

// ─── Persistenza Asincrona con Debounce ─────────────────────
function loadState() {
  try {
    if (existsSync(SAVE_FILE)) {
      const raw = readFileSync(SAVE_FILE, 'utf8');
      const saved = JSON.parse(raw);
      const def = defaultState();
      // Ripristina solo players e settings validi
      if (saved.players && typeof saved.players === 'object') {
        for (const [id, val] of Object.entries(saved.players)) {
          if (id && id !== '__proto__' && id !== 'constructor' && id !== 'prototype') {
            def.players[id] = {
              name: String(val.name || 'Giocatore').slice(0, 25),
              score: Number.isFinite(val.score) ? val.score : 0,
            };
          }
        }
      }
      if (saved.game?.settings && typeof saved.game.settings === 'object') {
        def.game.settings = { ...def.game.settings, ...saved.game.settings };
      }
      console.log(`[💾] Stato ripristinato: ${Object.keys(def.players).length} giocatori`);
      return def;
    }
  } catch (e) {
    console.warn('[💾] Impossibile caricare il salvataggio:', e.message);
  }
  return defaultState();
}

let saveTimeout = null;
function saveState() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const payload = JSON.stringify({
        players: state.players,
        game: { settings: state.game.settings },
      });
      await fsPromises.writeFile(SAVE_FILE, payload, 'utf8');
    } catch (e) {
      console.warn('[💾] Errore salvataggio:', e.message);
    }
  }, 300);
}

// Flush immediato alla chiusura del processo
function flushSaveSync() {
  try {
    writeFileSync(SAVE_FILE, JSON.stringify({
      players: state.players,
      game: { settings: state.game.settings },
    }), 'utf8');
  } catch (_) {}
}
process.on('SIGINT', () => { flushSaveSync(); process.exit(0); });
process.on('SIGTERM', () => { flushSaveSync(); process.exit(0); });

const state = loadState();

// ─── Store immagini in-memory ────────────────────────────────
const imageStore = new Map();
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// ─── Autenticazione Host & Token di Sessione ──────────────────
// Tokens validi (persistono in memoria durante il processo)
const validHostTokens = new Map(); // token -> { createdAt, ip }
const hostClients = new Set();      // ws autenticati
const authRateLimits = new Map();   // ip -> { count, blockedUntil }

function cleanExpiredTokens() {
  const now = Date.now();
  // Token validi per 24 ore
  for (const [token, data] of validHostTokens.entries()) {
    if (now - data.createdAt > 24 * 60 * 60 * 1000) {
      validHostTokens.delete(token);
    }
  }
}
setInterval(cleanExpiredTokens, 60 * 60 * 1000);

// Confronto costante per prevenire timing attacks
function timingSafePinCheck(inputPin, correctPin) {
  if (typeof inputPin !== 'string' || typeof correctPin !== 'string') return false;
  const inBuf = Buffer.from(inputPin);
  const corBuf = Buffer.from(correctPin);
  if (inBuf.length !== corBuf.length) return false;
  return crypto.timingSafeEqual(inBuf, corBuf);
}

// ─── Server HTTP + WebSocket ─────────────────────────────────
const httpServer = createServer((req, res) => {
  // Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Image-Mime, X-Host-Token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── GET /image/:id ─── serve l'immagine ────────────────────
  const getMatch = req.url.match(/^\/image\/([a-zA-Z0-9_-]+)$/);
  if (req.method === 'GET' && getMatch) {
    const id = getMatch[1];
    const entry = imageStore.get(id);
    if (!entry) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': entry.mime,
      'Content-Length': entry.buffer.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    res.end(entry.buffer);
    return;
  }

  // ── POST /image ─── riceve un'immagine dall'host ────────────
  if (req.method === 'POST' && req.url === '/image') {
    // Validazione MIME type contro upload arbitrari / stored XSS
    const rawMime = (req.headers['x-image-mime'] || 'image/jpeg').toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIME.has(rawMime)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Formato immagine non consentito (solo JPG, PNG, WEBP, GIF)' }));
      return;
    }

    const chunks = [];
    let bytesReceived = 0;
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB max

    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_IMAGE_BYTES) {
        res.writeHead(413, { 'Content-Type': 'text/plain' });
        res.end('Image too large (max 10MB)');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (res.writableEnded) return;
      const buffer = Buffer.concat(chunks);
      const imageId = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      imageStore.set(imageId, { buffer, mime: rawMime });

      // Conserva massimo 15 immagini in RAM
      if (imageStore.size > 15) {
        const oldest = imageStore.keys().next().value;
        imageStore.delete(oldest);
      }

      console.log(`[🖼️] Immagine salvata: ${imageId} (${(buffer.length / 1024).toFixed(1)} KB)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ imageId }));
    });

    req.on('error', () => {
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Upload error');
      }
    });
    return;
  }

  // Fallback
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SuperBuzzer WS Server\n');
});

const wss = new WebSocketServer({ server: httpServer });

// Messaggi che richiedono privilegi host
const HOST_ONLY_TYPES = new Set([
  'CORRECT', 'WRONG', 'SHOW_SLIDE', 'OPEN_BUZZER', 'REOPEN_BUZZER',
  'HIDE_SLIDE', 'RESET_BUZZERS', 'UPDATE_SETTINGS', 'UPDATE_SCORE',
  'RESET_SCORES', 'CLEAR_PLAYERS', 'REMOVE_PLAYER',
]);

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function broadcastState() {
  broadcast({ type: 'STATE', game: state.game, players: state.players });
}

// ─── WebSocket Heartbeat & Keepalive ──────────────────────────
// Rileva e termina socket zombie (fondamentale dietro Cloudflare/proxy)
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      hostClients.delete(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (_) {}
  });
}, 25000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// ─── Connessione client ──────────────────────────────────────
wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  const ip = req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress || '127.0.0.1';

  console.log(`[+] Client connesso: ${ip} (tot: ${wss.clients.size})`);

  // Invia immediatamente lo stato corrente
  ws.send(JSON.stringify({ type: 'STATE', game: state.game, players: state.players }));

  ws.on('message', (rawData) => {
    ws.isAlive = true;
    try {
      const msg = JSON.parse(rawData.toString());
      if (!msg || typeof msg !== 'object') return;

      // ── Heartbeat Ping del client ──
      if (msg.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }
      if (msg.type === 'PONG') {
        return;
      }

      // ── Richiesta stato aggiornato ──
      if (msg.type === 'GET_STATE') {
        ws.send(JSON.stringify({ type: 'STATE', game: state.game, players: state.players }));
        return;
      }

      // ─── Autenticazione Host con PIN (con Rate Limiting) ──
      if (msg.type === 'AUTH_HOST') {
        const now = Date.now();
        const ipRecord = authRateLimits.get(ip) || { count: 0, blockedUntil: 0 };

        if (ipRecord.blockedUntil > now) {
          const waitSec = Math.ceil((ipRecord.blockedUntil - now) / 1000);
          ws.send(JSON.stringify({
            type: 'AUTH_FAIL',
            reason: `Troppi tentativi errati. Riprova tra ${waitSec} secondi.`,
          }));
          return;
        }

        const pin = String(msg.pin ?? '').trim();
        const correctPin = String(state.game.settings.hostPin ?? '1234');

        if (timingSafePinCheck(pin, correctPin)) {
          // Successo: genera token host
          authRateLimits.delete(ip);
          const hostToken = crypto.randomBytes(32).toString('hex');
          validHostTokens.set(hostToken, { createdAt: now, ip });
          hostClients.add(ws);
          ws.hostToken = hostToken;

          ws.send(JSON.stringify({ type: 'AUTH_OK', hostToken }));
          console.log(`[🔑] Host autenticato con successo da ${ip}`);
        } else {
          ipRecord.count += 1;
          if (ipRecord.count >= 5) {
            ipRecord.blockedUntil = now + 5 * 60 * 1000; // Blocco per 5 minuti
            console.warn(`[🚨] IP ${ip} temporaneamente bloccato per brute force PIN`);
          }
          authRateLimits.set(ip, ipRecord);
          ws.send(JSON.stringify({ type: 'AUTH_FAIL', reason: 'PIN errato' }));
          console.warn(`[🚫] Tentativo PIN errato da ${ip} (tentativo ${ipRecord.count}/5)`);
        }
        return;
      }

      // ─── Ri-autenticazione automatica con Host Token ───────
      // Permette all'host di riconnettersi all'istante senza perdere privilegi
      if (msg.type === 'AUTH_TOKEN') {
        const token = String(msg.token ?? '');
        if (token && validHostTokens.has(token)) {
          hostClients.add(ws);
          ws.hostToken = token;
          ws.send(JSON.stringify({ type: 'AUTH_OK', hostToken: token }));
          console.log(`[🔑] Host ri-autenticato via token da ${ip}`);
        } else {
          ws.send(JSON.stringify({ type: 'AUTH_TOKEN_FAIL' }));
        }
        return;
      }

      // ─── Blocca messaggi privilegiati da non-host ────────
      if (HOST_ONLY_TYPES.has(msg.type) && !hostClients.has(ws)) {
        console.warn(`[🚫] Messaggio '${msg.type}' rifiutato: client non autenticato (${ip})`);
        ws.send(JSON.stringify({ type: 'ERROR', reason: 'Non autorizzato' }));
        return;
      }

      handleMessage(msg);
    } catch (e) {
      console.error('Messaggio non valido:', e.message);
    }
  });

  ws.on('close', () => {
    hostClients.delete(ws);
    console.log(`[-] Client disconnesso (tot: ${wss.clients.size})`);
  });
});

// ─── Gestione messaggi ───────────────────────────────────────
function handleMessage(msg) {
  switch (msg.type) {

    case 'JOIN': {
      let { id, name } = msg;
      if (typeof id !== 'string' || typeof name !== 'string') return;
      id = id.trim();
      name = name.trim().slice(0, 25);
      if (!name) return;

      // Sanitizzazione contro prototype pollution
      if (id === '__proto__' || id === 'constructor' || id === 'prototype') return;
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return;

      // Limite giocatori attivi
      if (!state.players[id] && Object.keys(state.players).length >= 200) {
        return;
      }

      if (!state.players[id]) {
        state.players[id] = { name, score: 0 };
      } else {
        state.players[id].name = name;
      }
      saveState();
      broadcastState();
      break;
    }

    case 'BUZZ': {
      const { playerId, playerName } = msg;
      if (typeof playerId !== 'string' || !state.players[playerId]) break;

      // Accetta buzz solo in fase buzzer o buzzed
      if (state.game.phase !== 'buzzer' && state.game.phase !== 'buzzed') break;
      // Blocca chi ha già sbagliato su questa slide
      if (state.game.wrongPlayers?.includes(playerId)) break;
      // Blocca chi si è già prenotato su questa slide
      if (state.game.buzzedThisSlide?.includes(playerId)) break;
      // Blocca se già in coda (doppio click)
      if (state.game.buzzQueue.find((p) => p.id === playerId)) break;
      // Coda piena (max 3)
      if (state.game.buzzQueue.length >= 3) break;

      const safeName = String(playerName || state.players[playerId].name).slice(0, 25);
      const entry = { id: playerId, name: safeName };
      state.game.buzzQueue.push(entry);
      if (!state.game.buzzedThisSlide) state.game.buzzedThisSlide = [];
      state.game.buzzedThisSlide.push(playerId);

      if (!state.game.isBuzzed) {
        // Primo buzz – diventa il corrente
        state.game.isBuzzed = true;
        state.game.buzzedBy = entry;
        state.game.phase = 'buzzed';
      }
      broadcastState();
      break;
    }

    case 'CORRECT': {
      // Assegna punti al giocatore corrente
      const order = state.game.correctAnswerOrder ?? 0;
      const pts = ['points1st', 'points2nd', 'points3rd'];
      let points = state.game.settings[pts[Math.min(order, 2)]] ?? 0;
      if (state.game.currentSlide?.isDoublePoints) points *= 2;
      const id = state.game.buzzedBy?.id;
      if (id && state.players[id]) {
        state.players[id].score = (state.players[id].score || 0) + points;
      }
      // Reset completo – risposta corretta, fine round
      state.game.isBuzzed = false;
      state.game.buzzedBy = null;
      state.game.buzzQueue = [];
      state.game.wrongPlayers = [];
      state.game.buzzedThisSlide = [];
      state.game.correctAnswerOrder = 0;
      state.game.phase = 'idle';
      state.game.currentSlide = null;
      saveState();
      broadcastState();
      break;
    }

    case 'WRONG': {
      // Penalità al giocatore corrente
      let penalty = state.game.settings.penalty ?? 0;
      if (state.game.currentSlide?.isDoublePoints) penalty *= 2;
      const id = state.game.buzzedBy?.id;
      if (id && state.players[id]) {
        state.players[id].score = (state.players[id].score || 0) - penalty;
        if (!state.game.wrongPlayers) state.game.wrongPlayers = [];
        state.game.wrongPlayers.push(id);
      }

      // Rimuovi il corrente dalla coda e passa al successivo
      const newQueue = (state.game.buzzQueue || []).slice(1);

      if (newQueue.length > 0 && state.game.correctAnswerOrder < 2) {
        // Passa al prossimo (2° o 3°)
        state.game.buzzedBy = newQueue[0];
        state.game.buzzQueue = newQueue;
        state.game.correctAnswerOrder += 1;
        state.game.isBuzzed = true;
        state.game.phase = 'buzzed';
      } else {
        // Coda esaurita o 3° sbagliato → torna a slide/idle
        state.game.isBuzzed = false;
        state.game.buzzedBy = null;
        state.game.buzzQueue = [];
        state.game.correctAnswerOrder = 0;
        state.game.phase = state.game.currentSlide ? 'slide' : 'idle';
      }
      saveState();
      broadcastState();
      break;
    }

    case 'SHOW_SLIDE': {
      if (msg.slide && typeof msg.slide === 'object') {
        state.game.currentSlide = {
          title: String(msg.slide.title || '').slice(0, 100),
          mediaType: ['audio', 'image', 'text'].includes(msg.slide.mediaType) ? msg.slide.mediaType : 'audio',
          text: msg.slide.text ? String(msg.slide.text).slice(0, 500) : null,
          imageId: msg.slide.imageId ? String(msg.slide.imageId).slice(0, 64) : null,
          imageData: msg.slide.imageData ? String(msg.slide.imageData) : null,
          isDoublePoints: Boolean(msg.slide.isDoublePoints),
        };
      } else {
        state.game.currentSlide = null;
      }
      state.game.phase = 'slide';
      state.game.isBuzzed = false;
      state.game.buzzedBy = null;
      state.game.buzzQueue = [];
      state.game.wrongPlayers = [];
      state.game.buzzedThisSlide = [];
      state.game.correctAnswerOrder = 0;
      broadcastState();
      break;
    }

    case 'OPEN_BUZZER': {
      if (state.game.phase === 'slide' || state.game.phase === 'idle') {
        state.game.phase = 'buzzer';
        state.game.isBuzzed = false;
        state.game.buzzedBy = null;
        state.game.buzzQueue = [];
        state.game.correctAnswerOrder = 0;
      }
      broadcastState();
      break;
    }

    case 'REOPEN_BUZZER': {
      state.game.phase = 'buzzer';
      state.game.isBuzzed = false;
      state.game.buzzedBy = null;
      state.game.buzzQueue = [];
      state.game.wrongPlayers = [];
      state.game.correctAnswerOrder = 0;
      broadcastState();
      break;
    }

    case 'HIDE_SLIDE': {
      state.game.phase = 'idle';
      state.game.currentSlide = null;
      state.game.isBuzzed = false;
      state.game.buzzedBy = null;
      state.game.buzzQueue = [];
      state.game.wrongPlayers = [];
      state.game.buzzedThisSlide = [];
      state.game.correctAnswerOrder = 0;
      broadcastState();
      break;
    }

    case 'RESET_BUZZERS': {
      state.game.isBuzzed = false;
      state.game.buzzedBy = null;
      state.game.buzzQueue = [];
      state.game.wrongPlayers = [];
      state.game.buzzedThisSlide = [];
      state.game.correctAnswerOrder = 0;
      state.game.phase = state.game.currentSlide ? 'slide' : 'idle';
      broadcastState();
      break;
    }

    case 'UPDATE_SETTINGS': {
      if (!msg.settings || typeof msg.settings !== 'object') break;
      const s = msg.settings;
      if (typeof s.hostPin === 'string' && s.hostPin.length >= 3 && s.hostPin.length <= 20) {
        state.game.settings.hostPin = s.hostPin;
      }
      ['points1st', 'points2nd', 'points3rd', 'penalty'].forEach((k) => {
        if (k in s && typeof s[k] === 'number' && Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 100) {
          state.game.settings[k] = Math.round(s[k]);
        }
      });
      saveState();
      broadcastState();
      break;
    }

    case 'UPDATE_SCORE': {
      const { playerId, delta } = msg;
      if (
        typeof playerId === 'string' &&
        state.players[playerId] &&
        typeof delta === 'number' &&
        Number.isFinite(delta) &&
        Math.abs(delta) <= 1000
      ) {
        state.players[playerId].score = (state.players[playerId].score || 0) + Math.round(delta);
        saveState();
        broadcastState();
      }
      break;
    }

    case 'RESET_SCORES': {
      Object.keys(state.players).forEach((id) => {
        if (state.players[id]) state.players[id].score = 0;
      });
      saveState();
      broadcastState();
      break;
    }

    case 'CLEAR_PLAYERS': {
      state.players = {};
      state.game.isBuzzed = false;
      state.game.buzzedBy = null;
      state.game.buzzQueue = [];
      state.game.wrongPlayers = [];
      state.game.buzzedThisSlide = [];
      state.game.correctAnswerOrder = 0;
      state.game.phase = 'idle';
      state.game.currentSlide = null;
      saveState();
      broadcastState();
      break;
    }

    case 'REMOVE_PLAYER': {
      if (typeof msg.playerId === 'string' && msg.playerId !== '__proto__') {
        delete state.players[msg.playerId];
        saveState();
        broadcastState();
      }
      break;
    }
  }
}

// ─── Start ───────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 SuperBuzzer WebSocket server avviato su porta ${PORT}`);
  console.log(`   🌐 Dominio Cloudflare: https://gioco.elettronicaimpianti.it`);
  console.log(`   📱 Connettiti da LAN: ws://[IP-MAC]:${PORT}`);
});
