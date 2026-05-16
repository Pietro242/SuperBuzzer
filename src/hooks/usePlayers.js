// usePlayers.js – Listener in tempo reale del nodo "players" su Firebase RTDB
import { useEffect, useState } from 'react';
import { ref, onValue, update, remove, set } from 'firebase/database';
import { db } from '../firebase';

export function usePlayers() {
  const [players, setPlayers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const playersRef = ref(db, 'players');
    const unsubscribe = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        setPlayers(snapshot.val());
      } else {
        setPlayers({});
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  /** Aggiunge o aggiorna un giocatore */
  const addOrUpdatePlayer = async (id, name) => {
    const playerRef = ref(db, `players/${id}`);
    await update(playerRef, { name, score: 0, isConnected: true });
  };

  /** Assegna/modifica il punteggio di un giocatore */
  const updateScore = async (id, delta) => {
    const player = players[id];
    if (!player) return;
    const newScore = (player.score || 0) + delta;
    await update(ref(db, `players/${id}`), { score: newScore });
  };

  /** Rimuove un giocatore */
  const removePlayer = async (id) => {
    await remove(ref(db, `players/${id}`));
  };

  /** Reset punteggi di tutti i giocatori */
  const resetAllScores = async () => {
    const updates = {};
    Object.keys(players).forEach((id) => {
      updates[`players/${id}/score`] = 0;
    });
    await update(ref(db), updates);
  };

  /** Reset completo (rimuove tutti i giocatori) */
  const clearAllPlayers = async () => {
    await set(ref(db, 'players'), null);
  };

  /** Lista ordinata per punteggio */
  const sortedPlayers = Object.entries(players)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    players,
    sortedPlayers,
    loading,
    addOrUpdatePlayer,
    updateScore,
    removePlayer,
    resetAllScores,
    clearAllPlayers,
  };
}
