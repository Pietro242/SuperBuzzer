// server.js – SuperBuzzer WebSocket Server (locale, LAN)
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const PORT = 3001;
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

// ─── Persistenza ────────────────────────────────────────────
function loadState() {
  try {
    if (existsSync(SAVE_FILE)) {
      const raw = readFileSync(SAVE_FILE, 'utf8');
      const saved = JSON.parse(raw);
      const def = defaultState();
      // Ripristina solo players e settings, il game state repart da idle
      def.players = saved.players ?? {};
      if (saved.game?.settings) def.game.settings = { ...def.game.settings, ...saved.game.settings };
      console.log(`[💾] Stato ripristinato: ${Object.keys(def.players).length} giocatori`);
      return def;
    }
  } catch (e) {
    console.warn('[💾] Impossibile caricare il salvataggio:', e.message);
  }
  return defaultState();
}

function saveState() {
  try {
    writeFileSync(SAVE_FILE, JSON.stringify({
      players: state.players,
      game: { settings: state.game.settings },
    }), 'utf8');
  } catch (e) {
    console.warn('[💾] Impossibile salvare:', e.message);
  }
}

const state = loadState();

// ─── Server HTTP + WebSocket ─────────────────────────────────
const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SuperBuzzer WS Server\n');
});

const wss = new WebSocketServer({ server: httpServer });

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

// ─── Connessione client ──────────────────────────────────────
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[+] Client connesso: ${ip} (tot: ${wss.clients.size})`);
  ws.send(JSON.stringify({ type: 'STATE', game: state.game, players: state.players }));

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());
      handleMessage(msg);
    } catch (e) {
      console.error('Messaggio non valido:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`[-] Client disconnesso (tot: ${wss.clients.size})`);
  });
});

// ─── Gestione messaggi ───────────────────────────────────────
function handleMessage(msg) {
  switch (msg.type) {

    case 'JOIN': {
      const { id, name } = msg;
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

      const entry = { id: playerId, name: playerName };
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
        // L'host deve riaprire manualmente il buzzer
        state.game.isBuzzed = false;
        state.game.buzzedBy = null;
        state.game.buzzQueue = [];
        state.game.correctAnswerOrder = 0;
        // wrongPlayers e buzzedThisSlide rimangono: chi ha già giocato è bloccato
        state.game.phase = state.game.currentSlide ? 'slide' : 'idle';
      }
      saveState();
      broadcastState();
      break;
    }

    case 'SHOW_SLIDE': {
      // Nuova slide – reset completo incluso chi ha buzzato
      state.game.currentSlide = msg.slide || null;
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
      // Apre (o riapre) il buzzer – NON resetta buzzedThisSlide
      // così chi aveva già buzzato resta bloccato
      if (state.game.phase === 'slide' || state.game.phase === 'idle') {
        state.game.phase = 'buzzer';
        state.game.isBuzzed = false;
        state.game.buzzedBy = null;
        state.game.buzzQueue = [];
        state.game.correctAnswerOrder = 0;
        // wrongPlayers e buzzedThisSlide si conservano
      }
      broadcastState();
      break;
    }

    case 'REOPEN_BUZZER': {
      // Riapre il buzzer dopo che tutti e 3 hanno sbagliato (o se l'host vuole)
      // Svuota coda e wrong, ma conserva buzzedThisSlide (chi ha già giocato non riparte)
      state.game.phase = 'buzzer';
      state.game.isBuzzed = false;
      state.game.buzzedBy = null;
      state.game.buzzQueue = [];
      state.game.wrongPlayers = [];
      state.game.correctAnswerOrder = 0;
      // buzzedThisSlide rimane → chi aveva già buzzato non può più
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
      // Reset buzzer manuale (svuota tutto tranne slide)
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
      state.game.settings = { ...state.game.settings, ...msg.settings };
      saveState();
      broadcastState();
      break;
    }

    case 'UPDATE_SCORE': {
      const { playerId, delta } = msg;
      if (state.players[playerId]) {
        state.players[playerId].score = (state.players[playerId].score || 0) + delta;
      }
      saveState();
      broadcastState();
      break;
    }

    case 'RESET_SCORES': {
      Object.keys(state.players).forEach((id) => {
        state.players[id].score = 0;
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
      delete state.players[msg.playerId];
      saveState();
      broadcastState();
      break;
    }
  }
}

// ─── Start ───────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 SuperBuzzer WebSocket server avviato su porta ${PORT}`);
  console.log(`   Connettiti da LAN: ws://[IP-MAC]:${PORT}`);
});
