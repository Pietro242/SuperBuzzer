// useGameState.js – Listener in tempo reale del nodo "game" su Firebase RTDB
import { useEffect, useState } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { db } from '../firebase';

const DEFAULT_GAME_STATE = {
  isBuzzed: false,
  buzzedBy: null,
  buzzQueue: [],
  isPlaying: false,
  currentRound: 0,
  correctAnswerOrder: 0,
  settings: {
    hostPin: '1234',
    points1st: 3,
    points2nd: 2,
    points3rd: 1,
    penalty: 1,
  },
};

export function useGameState() {
  const [gameState, setGameState] = useState(DEFAULT_GAME_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gameRef = ref(db, 'game');

    // Inizializza il nodo se non esiste
    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setGameState({
          ...DEFAULT_GAME_STATE,
          ...data,
          buzzQueue: data.buzzQueue || [],
          settings: { ...DEFAULT_GAME_STATE.settings, ...(data.settings || {}) },
        });
      } else {
        // Prima volta: inizializza il DB
        set(gameRef, DEFAULT_GAME_STATE);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateGame = async (updates) => {
    const gameRef = ref(db, 'game');
    await update(gameRef, updates);
  };

  const updateSettings = async (settings) => {
    const settingsRef = ref(db, 'game/settings');
    await update(settingsRef, settings);
  };

  const resetBuzzers = async () => {
    await update(ref(db, 'game'), {
      isBuzzed: false,
      buzzedBy: null,
      buzzQueue: [],
      correctAnswerOrder: 0,
    });
  };

  /**
   * Quando l'Host preme "Sbagliato":
   * Rimuove il giocatore dalla coda e promuove il prossimo.
   */
  const advanceBuzzQueue = async (currentQueue, penalty, players) => {
    const newQueue = [...(currentQueue || [])];
    // Il primo è già stato servito – lo rimuoviamo
    const removedId = newQueue.shift();

    if (newQueue.length > 0) {
      const nextPlayer = newQueue[0];
      await update(ref(db, 'game'), {
        isBuzzed: true,
        buzzedBy: nextPlayer,
        buzzQueue: newQueue,
        correctAnswerOrder: (players?.correctAnswerOrder ?? 0) + 1,
      });
    } else {
      await resetBuzzers();
    }

    return removedId;
  };

  return { gameState, loading, updateGame, updateSettings, resetBuzzers, advanceBuzzQueue };
}
