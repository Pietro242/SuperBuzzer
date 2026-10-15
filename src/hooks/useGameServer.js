// useGameServer.js – Hook WebSocket robusto con Keepalive, Heartbeat e Riconnessione
import { useEffect, useRef, useState, useCallback } from 'react';

function getWsUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const isHttps = window.location.protocol === 'https:';
  const wsProto = isHttps ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${wsProto}//${host}/ws`;
}

export function useGameServer() {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState({});
  const [isHost, setIsHost] = useState(() => Boolean(sessionStorage.getItem('superbuzzer_host_token')));
  const [authError, setAuthError] = useState('');

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const lastActivityRef = useRef(0);
  const mountedRef = useRef(true);
  const connectRef = useRef(null);

  // Funzione send sicura
  const send = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('[WS] Errore invio:', err);
      }
    } else {
      console.warn('[WS] Non connesso, messaggio ignorato:', msg?.type);
    }
  }, []);

  const authHost = useCallback((pin) => {
    send({ type: 'AUTH_HOST', pin });
  }, [send]);

  const hostLogout = useCallback(() => {
    sessionStorage.removeItem('superbuzzer_host_token');
    setIsHost(false);
    setAuthError('');
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      } catch (err) {
        void err;
      }
    }

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      const scheduleReconnect = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(() => {
          connectRef.current?.();
        }, 2000);
      };

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        lastActivityRef.current = Date.now();
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        console.log('[WS] Connesso al server SuperBuzzer');

        // Se l'host aveva un token valido, invialo subito
        const savedToken = sessionStorage.getItem('superbuzzer_host_token');
        if (savedToken) {
          try {
            ws.send(JSON.stringify({ type: 'AUTH_TOKEN', token: savedToken }));
          } catch (err) {
            void err;
          }
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        lastActivityRef.current = Date.now();

        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE') {
            setGameState(msg.game ?? null);
            setPlayers(msg.players ?? {});
          } else if (msg.type === 'PING') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PONG' }));
            }
          } else if (msg.type === 'PONG') {
            // Heartbeat OK
          } else if (msg.type === 'AUTH_OK') {
            setIsHost(true);
            setAuthError('');
            if (msg.hostToken) {
              sessionStorage.setItem('superbuzzer_host_token', msg.hostToken);
            }
          } else if (msg.type === 'AUTH_FAIL') {
            setIsHost(false);
            setAuthError(msg.reason || 'PIN errato!');
          } else if (msg.type === 'AUTH_TOKEN_FAIL') {
            setIsHost(false);
            sessionStorage.removeItem('superbuzzer_host_token');
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnesso dal server');
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.warn('[WS] Errore connessione:', err);
        try { ws.close(); } catch (closeErr) { void closeErr; }
      };
    } catch (e) {
      console.error('[WS] Errore inizializzazione:', e);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      reconnectRef.current = setTimeout(() => {
        connectRef.current?.();
      }, 2000);
    }
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    lastActivityRef.current = Date.now();
    connect();

    heartbeatTimerRef.current = setInterval(() => {
      const now = Date.now();
      const ws = wsRef.current;

      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PING' }));
        } catch (err) {
          void err;
        }

        if (now - lastActivityRef.current > 35000) {
          console.warn('[WS] Nessuna risposta per 35s, forzo riconnessione...');
          try { ws.close(); } catch (err) { void err; }
        }
      }
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'GET_STATE' }));
          } catch (err) {
            void err;
          }
        } else {
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch (err) {
          void err;
        }
      }
    };
  }, [connect]);

  const sortedPlayers = Object.entries(players)
    .filter(([id]) => id !== '__proto__' && id !== 'constructor' && id !== 'prototype')
    .map(([id, data]) => ({
      id,
      name: data?.name || 'Giocatore',
      score: Number.isFinite(data?.score) ? data.score : 0,
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    connected,
    gameState,
    players,
    sortedPlayers,
    send,
    isHost,
    authError,
    authHost,
    hostLogout,
  };
}
