// Scoreboard.jsx – Classifica in tempo reale
import { useEffect, useRef, useState } from 'react';

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = [
  'from-yellow-400/20 to-yellow-600/10 border-yellow-400/40',
  'from-gray-300/20 to-gray-500/10 border-gray-400/30',
  'from-orange-400/20 to-orange-700/10 border-orange-500/30',
];

export default function Scoreboard({ players = [], compact = false }) {
  const prevPlayersRef = useRef({});
  const [flashIds, setFlashIds] = useState(new Set());

  useEffect(() => {
    // Detect score changes per animazione flash
    const changed = new Set();
    players.forEach((p) => {
      const prev = prevPlayersRef.current[p.id];
      if (prev && prev.score !== p.score) changed.add(p.id);
    });

    const map = {};
    players.forEach((p) => { map[p.id] = p; });
    prevPlayersRef.current = map;

    if (changed.size > 0) {
      setFlashIds(changed);
      const timer = setTimeout(() => setFlashIds(new Set()), 700);
      return () => clearTimeout(timer);
    }
  }, [players]);

  if (!players || players.length === 0) {
    return (
      <div className="text-center text-white/30 py-8 text-lg font-body">
        Nessun giocatore ancora...
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${compact ? '' : 'gap-3'}`}>
      {players.map((player, index) => (
        <div
          key={player.id}
          id={`scoreboard-player-${player.id}`}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-2xl border
            transition-all duration-500
            ${index < 3 ? `bg-gradient-to-r ${MEDAL_COLORS[index]}` : 'glass'}
            ${flashIds.has(player.id) ? 'animate-rank-flash scale-[1.02]' : ''}
            ${compact ? 'py-2 rounded-xl' : ''}
          `}
        >
          {/* Posizione */}
          <div className={`font-display font-black ${compact ? 'text-xl w-6' : 'text-2xl w-8'} text-center shrink-0`}>
            {index < 3 ? MEDAL[index] : <span className="text-white/40">#{index + 1}</span>}
          </div>

          {/* Nome */}
          <div className="flex-1 min-w-0">
            <p className={`font-body font-semibold truncate ${compact ? 'text-base' : 'text-lg'} text-white`}>
              {player.name}
            </p>
          </div>

          {/* Punteggio con colore solido e visibilità garantita */}
          <div
            className={`font-display font-black shrink-0 ${compact ? 'text-2xl' : 'text-3xl'}`}
            style={
              index < 3
                ? {
                    background:
                      index === 0
                        ? 'linear-gradient(135deg, #facc15, #f59e0b)'
                        : index === 1
                        ? 'linear-gradient(135deg, #e5e7eb, #9ca3af)'
                        : 'linear-gradient(135deg, #fb923c, #c2410c)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    color: index === 0 ? '#facc15' : index === 1 ? '#d1d5db' : '#fb923c',
                  }
                : {
                    color: '#ffffff',
                  }
            }
          >
            {player.score ?? 0}
          </div>
        </div>
      ))}
    </div>
  );
}
