// ScreenView.jsx – Schermo TV/Proiettore (/schermo)
import { useGameServer } from '../hooks/useGameServer';
import { getImageUrl } from '../utils/imageUpload';

const MEDAL_STYLES = [
  { border: 'border-yellow-400/60', bg: 'from-yellow-400/20 to-yellow-600/5', text: 'text-yellow-300', emoji: '🥇' },
  { border: 'border-gray-300/50', bg: 'from-gray-300/15 to-gray-500/5', text: 'text-gray-200', emoji: '🥈' },
  { border: 'border-orange-400/50', bg: 'from-orange-400/15 to-orange-700/5', text: 'text-orange-300', emoji: '🥉' },
];

const PARTICLES = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  width: `${((i * 7) % 5) + 3}px`,
  height: `${((i * 7) % 5) + 3}px`,
  left: `${(i * 17) % 100}%`,
  top: `${(i * 23) % 100}%`,
  background: `hsl(${((i * 19) % 60) + 10}, 90%, 60%)`,
  duration: `${4 + (i % 4)}s`,
  delay: `${(i % 5) * 0.7}s`,
}));

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p) => (
        <div key={p.id} className="absolute rounded-full opacity-20"
          style={{
            width: p.width, height: p.height,
            left: p.left, top: p.top,
            background: p.background,
            animation: `float ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
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

  const showBuzzOverlay = phase === 'buzzed' && isBuzzed && buzzedBy;
  const showSlide = phase === 'slide' || phase === 'buzzer' || phase === 'buzzed';

  const joinUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.origin}/giocatore`
    : 'https://gioco.elettronicaimpianti.it/giocatore';
  const displayDomain = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? window.location.host
    : 'gioco.elettronicaimpianti.it';

  if (!connected) {
    return (
      <div className="h-screen bg-[#04040a] flex items-center justify-center overflow-hidden">
        <div className="text-center animate-pulse">
          <div className="text-7xl mb-6">📡</div>
          <p className="font-display font-black text-3xl text-white/20 tracking-widest uppercase">Connessione...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#04040a] overflow-hidden relative font-body">

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

      {/* ══ BANNER BUZZER APERTO ═══════════════════════════════ */}
      {phase === 'buzzer' && !showBuzzOverlay && (
        <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center animate-fade-in">
          <div className="px-10 py-4 rounded-full border border-green-400/40 bg-green-500/15 backdrop-blur-sm flex items-center gap-4">
            <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse" />
            <p className="font-display font-black text-3xl text-green-300 tracking-widest uppercase">
              BUZZER APERTO!
            </p>
            <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* ══ SLIDE ═══════════════════════════════════════════════
          Layout fisso: titolo (shrink-0) + area media (flex-1 min-h-0)
          Così l'immagine non esce mai dallo schermo.
      ════════════════════════════════════════════════════════ */}
      {showSlide && slide && (
        <div className={`absolute inset-0 z-10 flex flex-col transition-opacity duration-500 ${showBuzzOverlay ? 'opacity-20' : 'opacity-100'}`}>

          {/* Badge Punti Doppi — posizionato in absolute così non toglie spazio al layout */}
          {slide.isDoublePoints && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-2 rounded-full font-display font-black text-2xl uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse border-2 border-red-300 whitespace-nowrap">
              🔥 PUNTI DOPPI 🔥
            </div>
          )}

          {/* Titolo — shrink-0: occupa solo quanto serve, non cresce */}
          {slide.title && (
            <div className={`shrink-0 flex items-center justify-center px-10 ${slide.isDoublePoints ? 'pt-20' : 'pt-8'} pb-3`}>
              <div className="glass px-8 py-4 rounded-3xl border border-purple-400/40 bg-purple-500/10 text-center max-w-5xl w-full">
                <p className="font-display font-black text-white"
                  style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3.2rem)', lineHeight: 1.15 }}>
                  {slide.title}
                </p>
              </div>
            </div>
          )}

          {/* Area media — flex-1 min-h-0: prende tutto lo spazio rimanente
              min-h-0 è fondamentale: senza di esso flex-1 non rispetta il limite del parent */}
          <div className={`flex-1 min-h-0 flex items-center justify-center px-10 ${slide.title ? 'pb-6' : slide.isDoublePoints ? 'pt-20 pb-6' : 'pb-6'}`}>

            {/* Immagine: usa h-full e w-full con object-contain — non esce mai */}
            {slide.mediaType === 'image' && (slide.imageId || slide.imageData) && (
              <img
                src={slide.imageId ? getImageUrl(slide.imageId) : slide.imageData}
                className="h-full w-full object-contain rounded-3xl shadow-2xl animate-fade-in"
                alt="slide"
              />
            )}

            {/* Testo */}
            {slide.mediaType === 'text' && slide.text && (
              <div className="glass px-16 py-10 rounded-3xl border border-white/20 max-w-4xl text-center animate-fade-in">
                <p className="font-display font-bold text-white/90"
                  style={{ fontSize: 'clamp(2rem, 4.5vw, 4rem)', lineHeight: 1.3 }}>
                  {slide.text}
                </p>
              </div>
            )}

            {/* Audio */}
            {slide.mediaType === 'audio' && (
              <div className="text-center animate-float">
                <div style={{ fontSize: 'clamp(6rem, 20vw, 14rem)' }}>🎵</div>
                <p className="font-display font-bold text-white/30 uppercase tracking-[0.3em] mt-6"
                  style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)' }}>
                  Ascolta la canzone...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ CLASSIFICA (idle) ═══════════════════════════════════
          absolute inset-0 + flex flex-col: sempre h-screen, mai scroll
      ════════════════════════════════════════════════════════ */}
      <div className={`absolute inset-0 z-10 flex flex-col transition-all duration-500 ${
        showSlide || showBuzzOverlay ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}>
        <header className="shrink-0 flex items-center justify-between px-12 py-6">
          <div className="flex items-center gap-4">
            <div className="text-5xl animate-float">🎵</div>
            <div>
              <h1 className="font-display font-black text-4xl text-white tracking-tight leading-none">
                SUPER<span className="text-red-500">BUZZER</span>
              </h1>
              <p className="text-white/30 text-sm uppercase tracking-widest mt-1">Quiz Musicale</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-md">
              <span className="text-lg">📱</span>
              <span className="text-xs uppercase tracking-wider text-purple-300/80 font-bold">Entra su:</span>
              <span className="font-display font-bold text-white tracking-wider text-base">{displayDomain}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/60 text-sm uppercase tracking-wider">{sortedPlayers.length} giocatori</span>
            </div>
          </div>
        </header>

        {/* flex-1 min-h-0 overflow-y-auto: la lista scrolla se ci sono tanti giocatori */}
        <main className="flex-1 min-h-0 flex flex-col justify-start px-12 py-4 overflow-y-auto">
          {sortedPlayers.length === 0 ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-4 my-auto">
              <div className="glass px-10 py-8 rounded-3xl border border-white/15 max-w-lg w-full flex flex-col items-center shadow-2xl backdrop-blur-xl animate-fade-in">
                <div className="text-6xl mb-3 animate-float">📱</div>
                <h2 className="font-display font-black text-3xl text-white tracking-wider uppercase mb-1">
                  ENTRA IN PARTITA!
                </h2>
                <p className="text-white/60 text-sm mb-5">
                  Inquadra il QR Code con lo smartphone o collegati a:
                </p>
                <div className="p-3 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.2)] mb-5 hover:scale-105 transition-transform duration-300">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(joinUrl)}&margin=4`}
                    alt="QR Code per entrare"
                    className="w-48 h-48 rounded-lg"
                  />
                </div>
                <div className="px-6 py-2 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-display font-bold text-xl tracking-wider">
                  {displayDomain}
                </div>
                <p className="text-white/30 text-xs mt-4 uppercase tracking-widest animate-pulse">
                  In attesa che i concorrenti si colleghino...
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full">
              {sortedPlayers.map((player, index) => {
                const style = MEDAL_STYLES[index] ?? {
                  border: 'border-white/10', bg: 'from-white/5 to-white/0',
                  text: 'text-white/60', emoji: null,
                };
                return (
                  <div key={player.id} id={`screen-player-${player.id}`}
                    className={`flex items-center gap-6 px-8 py-4 rounded-3xl border bg-gradient-to-r
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
                        ...(index < 3
                          ? {
                              background:
                                index === 0
                                  ? 'linear-gradient(135deg, #facc15, #f59e0b)'
                                  : index === 1
                                  ? 'linear-gradient(135deg, #f0f0f0, #9ca3af)'
                                  : 'linear-gradient(135deg, #fb923c, #c2410c)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              color: index === 0 ? '#facc15' : index === 1 ? '#f0f0f0' : '#fb923c',
                            }
                          : {
                              color: 'rgba(255, 255, 255, 0.7)',
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

        <footer className="shrink-0 px-12 py-4 text-center">
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
