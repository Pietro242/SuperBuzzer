// ScreenView.jsx – Schermo TV/Proiettore (/schermo)
import { useEffect, useRef, useState } from 'react';
import { useGameServer } from '../hooks/useGameServer';

const MEDAL_STYLES = [
  { border: 'border-yellow-400/60', bg: 'from-yellow-400/20 to-yellow-600/5', text: 'text-yellow-300', emoji: '🥇' },
  { border: 'border-gray-300/50', bg: 'from-gray-300/15 to-gray-500/5', text: 'text-gray-200', emoji: '🥈' },
  { border: 'border-orange-400/50', bg: 'from-orange-400/15 to-orange-700/5', text: 'text-orange-300', emoji: '🥉' },
];

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 25 }, (_, i) => (
        <div key={i} className="absolute rounded-full opacity-20"
          style={{
            width: `${Math.random() * 5 + 2}px`, height: `${Math.random() * 5 + 2}px`,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            background: `hsl(${Math.random() * 60 + 10}, 90%, 60%)`,
            animation: `float ${3 + Math.random() * 5}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function ScreenView() {
  const { connected, gameState, sortedPlayers } = useGameServer();
  const buzzQueue = gameState?.buzzQueue ?? [];

  const phase = gameState?.phase ?? 'idle';
  const slide = gameState?.currentSlide ?? null;
  const isBuzzed = gameState?.isBuzzed ?? false;
  const buzzedBy = gameState?.buzzedBy ?? null;

  // Mostra overlay buzz
  const showBuzzOverlay = phase === 'buzzed' && isBuzzed && buzzedBy;
  // Mostra slide (anche durante buzzer aperto e buzzed)
  const showSlide = phase === 'slide' || phase === 'buzzer' || phase === 'buzzed';

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#04040a] flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-7xl mb-6">📡</div>
          <p className="font-display font-black text-3xl text-white/20 tracking-widest uppercase">Connessione...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04040a] overflow-hidden relative font-body">

      {/* Background dinamico */}
      <div className="absolute inset-0 transition-all duration-1000"
        style={{
          background: showBuzzOverlay
            ? 'radial-gradient(ellipse at 50% 30%, rgba(239,68,68,0.40) 0%, rgba(239,68,68,0.12) 40%, #04040a 80%)'
            : phase === 'buzzer'
            ? 'radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.07) 40%, #04040a 80%)'
            : phase === 'slide'
            ? 'radial-gradient(ellipse at 50% 30%, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.07) 40%, #04040a 80%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, #04040a 70%)',
        }}
      />

      <FloatingParticles />

      {/* Griglia decorativa */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* ══ OVERLAY BUZZER ══════════════════════════════════════ */}
      {showBuzzOverlay && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center">
          {/* Onde energia */}
          <div className="absolute flex items-center justify-center">
            {[1, 2, 3, 4].map((ring) => (
              <div key={ring} className="absolute rounded-full border-2 border-red-500/25 animate-ping"
                style={{ width: `${ring * 140}px`, height: `${ring * 140}px`, animationDelay: `${ring * 0.18}s`, animationDuration: '1.6s' }}
              />
            ))}
          </div>

          <div className="animate-buzz-in text-center px-10 relative z-10 w-full max-w-3xl">
            <p className="font-display font-black text-xl text-red-400/80 uppercase tracking-[0.4em] mb-4 animate-pulse">
              🚨 BUZZER!
            </p>

            {/* Slot 1° – chi risponde ora */}
            <div className="font-display font-black leading-none mb-4"
              style={{
                fontSize: 'clamp(4rem, 13vw, 10rem)',
                background: 'linear-gradient(135deg, #ffffff 0%, #fbbf24 50%, #ef4444 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                filter: 'drop-shadow(0 0 50px rgba(239,68,68,0.5))',
              }}>
              {buzzedBy.name.toUpperCase()}
            </div>
            <p className="font-display font-bold text-white/60 uppercase tracking-[0.3em] mb-6"
              style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)' }}>
              🥇 STA RISPONDENDO!
            </p>

            {/* Coda 2° e 3° */}
            {buzzQueue.length > 1 && (
              <div className="flex justify-center gap-4 mt-2">
                {buzzQueue.slice(1).map((p, i) => (
                  <div key={p.id} className="px-6 py-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 backdrop-blur-sm">
                    <p className="text-amber-300/60 text-xs uppercase tracking-wider mb-1">{i === 0 ? '🥈 2°' : '🥉 3°'}</p>
                    <p className="font-display font-black text-white/80"
                      style={{ fontSize: 'clamp(1.2rem, 3vw, 2.5rem)' }}>
                      {p.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ OVERLAY BUZZER APERTO ═══════════════════════════════ */}
      {phase === 'buzzer' && !showBuzzOverlay && (
        <div className="absolute inset-x-0 bottom-16 z-20 flex justify-center animate-fade-in">
          <div className="px-10 py-5 rounded-full border border-green-400/40 bg-green-500/15 backdrop-blur-sm flex items-center gap-4">
            <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse" />
            <p className="font-display font-black text-3xl text-green-300 tracking-widest uppercase">
              BUZZER APERTO!
            </p>
            <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* ══ SLIDE ═══════════════════════════════════════════════ */}
      {showSlide && slide && (
        <div className={`absolute inset-0 z-10 flex flex-col transition-opacity duration-500 ${showBuzzOverlay ? 'opacity-20' : 'opacity-100'}`}>
          {/* Titolo domanda */}
          {slide.title && (
            <div className="flex items-center justify-center pt-16 pb-8 px-16 relative">
              <div className="glass px-10 py-5 rounded-3xl border border-purple-400/40 bg-purple-500/10 text-center max-w-4xl relative">
                {slide.isDoublePoints && (
                   <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-2 rounded-full font-display font-black text-2xl uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse border-2 border-red-300 whitespace-nowrap">
                     🔥 PUNTI DOPPI 🔥
                   </div>
                )}
                <p className="font-display font-black text-white"
                  style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)', lineHeight: 1.1 }}>
                  {slide.title}
                </p>
              </div>
            </div>
          )}

          {/* Badge Punti Doppi per slide senza titolo */}
          {!slide.title && slide.isDoublePoints && (
             <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-2 rounded-full font-display font-black text-2xl uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse border-2 border-red-300 z-50 whitespace-nowrap">
               🔥 PUNTI DOPPI 🔥
             </div>
          )}

          {/* Immagine */}
          {slide.mediaType === 'image' && slide.imageData && (
            <div className="flex-1 flex items-center justify-center px-16 pb-16">
              <img
                src={slide.imageData}
                className="max-h-full max-w-full object-contain rounded-3xl shadow-2xl animate-fade-in"
                style={{ maxHeight: slide.title ? '55vh' : '75vh' }}
                alt="slide"
              />
            </div>
          )}

          {/* Testo */}
          {slide.mediaType === 'text' && slide.text && (
            <div className="flex-1 flex items-center justify-center px-16 pb-16">
              <div className="glass px-16 py-10 rounded-3xl border border-white/20 max-w-4xl text-center animate-fade-in">
                <p className="font-display font-bold text-white/90"
                  style={{ fontSize: 'clamp(2rem, 4.5vw, 4rem)', lineHeight: 1.3 }}>
                  {slide.text}
                </p>
              </div>
            </div>
          )}

          {/* Audio – mostra solo icona musicale animata */}
          {slide.mediaType === 'audio' && (
            <div className="flex-1 flex items-center justify-center pb-16">
              <div className="text-center animate-float">
                <div style={{ fontSize: 'clamp(6rem, 20vw, 14rem)' }}>🎵</div>
                <p className="font-display font-bold text-white/30 uppercase tracking-[0.3em] mt-6"
                  style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)' }}>
                  Ascolta la canzone...
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ CLASSIFICA (idle) ═══════════════════════════════════ */}
      <div className={`relative z-10 min-h-screen flex flex-col transition-all duration-500 ${
        showSlide || showBuzzOverlay ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}>
        <header className="flex items-center justify-between px-12 py-8">
          <div className="flex items-center gap-4">
            <div className="text-5xl animate-float">🎵</div>
            <div>
              <h1 className="font-display font-black text-4xl text-white tracking-tight leading-none">
                SUPER<span className="text-red-500">BUZZER</span>
              </h1>
              <p className="text-white/30 text-sm uppercase tracking-widest mt-1">Quiz Musicale</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/40 text-sm uppercase tracking-wider">{sortedPlayers.length} giocatori</span>
          </div>
        </header>

        <main className="flex-1 flex flex-col justify-center px-12 py-4">
          {sortedPlayers.length === 0 ? (
            <div className="text-center">
              <div className="text-8xl mb-8 animate-float">🎤</div>
              <p className="font-display font-black text-4xl text-white/20 uppercase tracking-widest">
                IN ATTESA DI GIOCATORI...
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">
              {sortedPlayers.map((player, index) => {
                const style = MEDAL_STYLES[index] ?? {
                  border: 'border-white/10', bg: 'from-white/5 to-white/0',
                  text: 'text-white/60', emoji: null,
                };
                return (
                  <div key={player.id} id={`screen-player-${player.id}`}
                    className={`flex items-center gap-6 px-8 py-5 rounded-3xl border bg-gradient-to-r
                      ${style.border} ${style.bg} shadow-xl transition-all duration-500 animate-fade-in
                      ${index === 0 ? 'scale-105' : ''}`}
                    style={{ animationDelay: `${index * 0.06}s` }}>
                    <div className="shrink-0 w-16 text-center">
                      {style.emoji
                        ? <span style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>{style.emoji}</span>
                        : <span className={`font-display font-black text-4xl ${style.text}`}>#{index + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-black text-white truncate"
                        style={{ fontSize: 'clamp(1.8rem, 4vw, 3.5rem)' }}>
                        {player.name}
                      </p>
                    </div>
                    <div className={`font-display font-black shrink-0 ${style.text}`}
                      style={{
                        fontSize: 'clamp(2.5rem, 5vw, 5rem)',
                        ...(index < 3 && {
                          background: index === 0 ? 'linear-gradient(135deg, #facc15, #f59e0b)' :
                            index === 1 ? 'linear-gradient(135deg, #f0f0f0, #9ca3af)' :
                            'linear-gradient(135deg, #fb923c, #c2410c)',
                          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }),
                      }}>
                      {player.score ?? 0}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <footer className="px-12 py-6 text-center">
          <p className="text-white/10 text-sm uppercase tracking-widest">⚡ SuperBuzzer</p>
        </footer>
      </div>

      {/* Bottone Fullscreen */}
      <button
        onClick={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
          } else {
            document.exitFullscreen();
          }
        }}
        className="fixed bottom-4 right-4 z-50 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white transition-all backdrop-blur-sm"
        title="Schermo intero"
      >
        ⛶
      </button>
    </div>
  );
}
