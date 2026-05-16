// useGameServer.js – Hook WebSocket che sostituisce Firebase
import { useEffect, useRef, useState, useCallback } from 'react';

const WS_PORT = 3001;

function getWsUrl() {
  const host = window.location.hostname;
  return `ws://${host}:${WS_PORT}`;
}

export function useGameServer() {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState({});
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        clearTimeout(reconnectRef.current);
        console.log('[WS] Connesso al server SuperBuzzer');
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE') {
            setGameState(msg.game ?? null);
            setPlayers(msg.players ?? {});
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        console.log('[WS] Disconnesso, riconnessione in 2s...');
        reconnectRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error('[WS] Errore connessione:', e);
      reconnectRef.current = setTimeout(connect, 2000);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('[WS] Non connesso, messaggio ignorato:', msg.type);
    }
  }, []);

  const sortedPlayers = Object.entries(players)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return { connected, gameState, players, sortedPlayers, send };
}
