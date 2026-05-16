// BuzzerButton.jsx – Il mega pulsante buzzer per i giocatori
import { useState } from 'react';

/**
 * status: 'idle' | 'active' | 'mine' | 'queued' | 'blocked' | 'wrong'
 * blockedByName: nome del giocatore che ha buzzato (solo se blocked)
 * queuePosition: posizione in coda (1-based, solo se queued)
 */
export default function BuzzerButton({ status, onBuzz, blockedByName, queuePosition }) {
  const [pressing, setPressing] = useState(false);

  const handlePress = () => {
    if (status !== 'active') return;
    setPressing(true);
    onBuzz();
    setTimeout(() => setPressing(false), 300);
  };

  const isActive = status === 'active';
  const isMine = status === 'mine';
  const isQueued = status === 'queued';
  const isBlocked = status === 'blocked';
  const isWrong = status === 'wrong';
  const isAlreadyBuzzed = status === 'already_buzzed';

  return (
    <div className="flex flex-col items-center justify-center gap-8 flex-1">

      {/* Anello esterno animato */}
      <div className="relative flex items-center justify-center">

        {/* Pulse rings – solo se attivo */}
        {isActive && (
          <>
            <div className="absolute w-72 h-72 rounded-full border-2 border-red-500/30 animate-ping" />
            <div
              className="absolute w-64 h-64 rounded-full border-2 border-red-400/40"
              style={{ animation: 'pulse-ring 1.5s ease infinite 0.3s' }}
            />
          </>
        )}

        {/* Glow ring – se ho buzzato io */}
        {isMine && (
          <div className="absolute w-72 h-72 rounded-full"
            style={{ boxShadow: '0 0 80px 20px rgba(16, 185, 129, 0.4)' }} />
        )}

        {/* Glow ring – in coda */}
        {isQueued && (
          <div className="absolute w-72 h-72 rounded-full"
            style={{ boxShadow: '0 0 60px 15px rgba(245, 158, 11, 0.3)' }} />
        )}

        {/* Pulsante principale */}
        <button
          id="buzzer-btn"
          onClick={handlePress}
          disabled={!isActive}
          className={`
            relative w-56 h-56 rounded-full font-display font-black text-3xl tracking-wider
            transition-all duration-200 select-none
            ${pressing ? 'scale-90' : 'scale-100'}
            ${isActive
              ? 'bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 text-white shadow-2xl shadow-red-500/50 hover:scale-105 cursor-pointer animate-pulse-ring'
              : isMine
              ? 'bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-2xl shadow-emerald-500/50 cursor-default'
              : isQueued
              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-2xl shadow-amber-500/50 cursor-default'
              : isWrong || isAlreadyBuzzed
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 text-red-500/50 cursor-not-allowed shadow-inner'
              : 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-500 cursor-not-allowed'}
          `}
          style={{
            ...(isActive && {
              boxShadow: '0 0 60px rgba(239,68,68,0.5), inset 0 -4px 0 rgba(0,0,0,0.3)',
            }),
            ...(isMine && {
              boxShadow: '0 0 60px rgba(16,185,129,0.5), inset 0 -4px 0 rgba(0,0,0,0.3)',
            }),
            ...(isQueued && {
              boxShadow: '0 0 60px rgba(245,158,11,0.5), inset 0 -4px 0 rgba(0,0,0,0.3)',
            }),
          }}
        >
          {/* Riflesso interno */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute top-4 left-8 w-20 h-8 bg-white/20 rounded-full blur-sm rotate-12" />
          </div>

          {/* Testo */}
          <span className="relative z-10 leading-none">
            {isActive && '⚡ BUZZ!'}
            {isMine && '✅ RISPONDI!'}
            {isQueued && `⏳ ${queuePosition}°`}
            {isWrong && '❌'}
            {isAlreadyBuzzed && '🔒'}
            {isBlocked && '🔒'}
          </span>
        </button>
      </div>

      {/* Messaggio di stato */}
      <div className="animate-slide-up text-center px-6">
        {isActive && (
          <p className="text-white/60 text-lg font-body">
            Premi il pulsante per prenotarti!
          </p>
        )}
        {isMine && (
          <div className="glass px-8 py-4 rounded-2xl bg-emerald-500/10 border-emerald-500/30">
            <p className="text-emerald-400 text-xl font-semibold font-body">
              🎉 È il tuo turno! Rispondi!
            </p>
          </div>
        )}
        {isQueued && (
          <div className="glass px-8 py-4 rounded-2xl bg-amber-500/10 border-amber-500/30 animate-fade-in">
            <p className="text-amber-400 text-lg font-semibold font-body">
              ⏳ Sei {queuePosition}° in coda
            </p>
            <p className="text-white/50 text-sm mt-1">
              Se chi risponde prima sbaglia, toccherà a te!
            </p>
          </div>
        )}
        {isWrong && (
          <div className="glass px-8 py-4 rounded-2xl bg-zinc-900/50 border-red-500/20 animate-fade-in">
            <p className="text-red-400/80 text-lg font-body">
              ❌ Risposta errata
            </p>
            <p className="text-white/40 text-sm mt-1">
              Non puoi più prenotarti per questa slide.
            </p>
          </div>
        )}
        {isAlreadyBuzzed && (
          <div className="glass px-8 py-4 rounded-2xl bg-zinc-900/50 border-red-500/20 animate-fade-in">
            <p className="text-red-400/80 text-lg font-body">
              🔒 Già prenotato
            </p>
            <p className="text-white/40 text-sm mt-1">
              Hai già usato il buzzer per questa slide.
            </p>
          </div>
        )}
        {isBlocked && (
          <div className="glass px-8 py-4 rounded-2xl bg-red-500/10 border-red-500/30 animate-buzz-in">
            <p className="text-red-400 text-lg font-body">
              🔒 Max 3 prenotazioni raggiunte
            </p>
            {blockedByName && (
              <p className="text-white/80 text-2xl font-display font-bold mt-1">
                {blockedByName} sta rispondendo
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
