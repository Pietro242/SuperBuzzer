// HostView.jsx – Dashboard Host (/host) con Slide + Media + Manche
import { useState, useRef, useCallback } from 'react';
import { useGameServer } from '../hooks/useGameServer';
import AudioPlayer from '../components/AudioPlayer';
import ScoreSettings from '../components/ScoreSettings';
import Scoreboard from '../components/Scoreboard';
import MancheEditor from '../components/MancheEditor';

const ORDER_EMOJI = ['🥇', '🥈', '🥉'];
const ORDER_COLOR = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];
const ORDER_LABEL = ['1°', '2°', '3°'];

// Converte un File immagine in base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function HostView() {
  const { connected, gameState, sortedPlayers, send } = useGameServer();

  // Auth
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isAuth, setIsAuth] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState('game');

  // Slide builder
  const [slideTitle, setSlideTitle] = useState('');
  const [slideMediaType, setSlideMediaType] = useState('audio'); // 'audio'|'image'|'text'
  const [slideText, setSlideText] = useState('');
  const [slideImageData, setSlideImageData] = useState(null); // base64
  const [slideImagePreview, setSlideImagePreview] = useState(null);
  const [slideIsDoublePoints, setSlideIsDoublePoints] = useState(false);

  // Audio player
  const [shouldPauseAudio, setShouldPauseAudio] = useState(false);

  // Confirm reset
  const [confirmReset, setConfirmReset] = useState(false);

  // Manche caricata
  const [loadedManche, setLoadedManche] = useState(null);
  const [mancheSlideIdx, setMancheSlideIdx] = useState(0);
  const mancheAudioRef = useRef(null);

  // Timer Audio
  const [audioTime, setAudioTime] = useState(0);
  const [stopAtInput, setStopAtInput] = useState('');
  const stopAtRef = useRef(null);

  const handleStopAtChange = (e) => {
    setStopAtInput(e.target.value);
    const val = parseFloat(e.target.value);
    stopAtRef.current = isNaN(val) ? null : val;
  };

  const setupAudio = (audio) => {
    audio.ontimeupdate = () => {
      setAudioTime(audio.currentTime);
      if (stopAtRef.current !== null && audio.currentTime >= stopAtRef.current) {
        audio.pause();
        stopAtRef.current = null;
        setStopAtInput('');
      }
    };
  };

  // Auto-pausa audio quando buzzer scatta
  const prevPhaseRef = useRef('idle');
  const phase = gameState?.phase ?? 'idle';
  if (phase === 'buzzed' && prevPhaseRef.current !== 'buzzed') {
    setShouldPauseAudio(true);
    if (mancheAudioRef.current) mancheAudioRef.current.pause();
  }
  if (phase !== 'buzzed' && prevPhaseRef.current === 'buzzed') {
    // nessuna azione speciale
  }
  prevPhaseRef.current = phase;

  // ─── PIN ─────────────────────────────────────────────────
  const handlePin = () => {
    if (pinInput === (gameState?.settings?.hostPin ?? '1234')) {
      setIsAuth(true); setPinError('');
    } else {
      setPinError('PIN errato!'); setPinInput('');
    }
  };

  // ─── Slide ───────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setSlideImageData(b64);
    setSlideImagePreview(b64);
  };

  const handleShowSlide = () => {
    const slide = {
      title: slideTitle.trim(),
      mediaType: slideMediaType,
      text: slideMediaType === 'text' ? slideText : null,
      imageData: slideMediaType === 'image' ? slideImageData : null,
      isDoublePoints: slideIsDoublePoints,
    };
    send({ type: 'SHOW_SLIDE', slide });
  };

  // ─── Manche controls ─────────────────────────────────
  const handleLoadManche = (manche) => {
    setLoadedManche(manche);
    setMancheSlideIdx(0);
    setActiveTab('game');
  };

  const handleUnloadManche = () => {
    if (mancheAudioRef.current) { mancheAudioRef.current.pause(); mancheAudioRef.current = null; }
    setLoadedManche(null);
    setMancheSlideIdx(0);
    handleHideSlide();
  };

  const launchMancheSlide = (idx) => {
    if (!loadedManche) return;
    const s = loadedManche.slides[idx];
    if (!s) return;
    // Stop previous audio
    if (mancheAudioRef.current) { mancheAudioRef.current.pause(); mancheAudioRef.current = null; }
    setMancheSlideIdx(idx);
    const slide = {
      title: s.title || '',
      mediaType: s.mediaType || 'audio',
      text: s.mediaType === 'text' ? s.text : null,
      imageData: s.mediaType === 'image' ? s.imageData : null,
      isDoublePoints: s.isDoublePoints || false,
    };
    send({ type: 'SHOW_SLIDE', slide });
    // Play audio if available
    if (s.audioBlob) {
      const url = URL.createObjectURL(s.audioBlob);
      const audio = new Audio(url);
      mancheAudioRef.current = audio;
      setAudioTime(0);
      setupAudio(audio);
      audio.play().catch(() => {});
    }
  };

  const handleManchePause = () => { if (mancheAudioRef.current) mancheAudioRef.current.pause(); };
  const handleMancheResume = () => { if (mancheAudioRef.current) mancheAudioRef.current.play().catch(() => {}); };
  const mancheSlide = loadedManche?.slides?.[mancheSlideIdx] ?? null;

  const handleOpenBuzzer = () => send({ type: 'OPEN_BUZZER' });
  const handleHideSlide = () => {
    send({ type: 'HIDE_SLIDE' });
    setShouldPauseAudio(false);
  };

  // ─── Azioni buzzer ───────────────────────────────────────
  const handleCorrect = () => {
    send({ type: 'CORRECT' });
    setShouldPauseAudio(false);

    if (mancheSlide?.correctAudioBlob) {
      if (mancheAudioRef.current) mancheAudioRef.current.pause();
      const url = URL.createObjectURL(mancheSlide.correctAudioBlob);
      const audio = new Audio(url);
      mancheAudioRef.current = audio;
      setAudioTime(0);
      setupAudio(audio);
      audio.play().catch(() => {});
    }
  };
  const handleWrong = () => send({ type: 'WRONG' });
  const handleResetBuzzers = () => {
    send({ type: 'RESET_BUZZERS' });
    setShouldPauseAudio(false);
  };
  const handleReopenBuzzer = () => {
    send({ type: 'REOPEN_BUZZER' });
    setShouldPauseAudio(false);
  };

  const handleResetScores = () => { send({ type: 'RESET_SCORES' }); setConfirmReset(false); };
  const handleClearAll = () => { send({ type: 'CLEAR_PLAYERS' }); setConfirmReset(false); setShouldPauseAudio(false); };

  const buzzOrder = gameState?.correctAnswerOrder ?? 0;
  const ptKeys = ['points1st', 'points2nd', 'points3rd'];
  const pointsForOrder = gameState?.settings?.[ptKeys[Math.min(buzzOrder, 2)]] ?? 0;

  // ─── Schermata connessione ───────────────────────────────
  if (!connected) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-5xl mb-4">📡</div>
          <p className="text-white/40 text-lg font-body">Connessione al server...</p>
        </div>
      </div>
    );
  }

  // ─── PIN Gate ────────────────────────────────────────────
  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-72 h-72 bg-blue-600/15 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 w-full max-w-sm animate-slide-up">
          <div className="text-center mb-10">
            <div className="text-6xl mb-4">🎙️</div>
            <h1 className="font-display font-black text-4xl text-white">HOST <span className="text-purple-400">PANEL</span></h1>
            <p className="text-white/40 font-body mt-2">Inserisci il PIN per accedere</p>
          </div>
          <div className="glass p-8 flex flex-col gap-5">
            <input
              id="host-pin-gate-input" type="password" value={pinInput}
              onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePin()}
              placeholder="• • • •"
              className="input-base text-center text-3xl tracking-[0.8em] font-display font-bold"
              maxLength={8} autoFocus
            />
            {pinError && <p className="text-red-400 text-sm text-center animate-shake">{pinError}</p>}
            <button id="host-pin-submit-btn" onClick={handlePin}
              className="btn-primary w-full py-4 text-lg font-display font-bold">🔓 ACCEDI</button>
          </div>
          <p className="text-center text-white/20 text-xs mt-4">PIN default: 1234</p>
        </div>
      </div>
    );
  }

  // ─── Dashboard ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col font-body">

      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎙️</span>
          <div>
            <h1 className="font-display font-bold text-xl leading-none">HOST PANEL</h1>
            <p className="text-white/30 text-xs uppercase tracking-wider">SuperBuzzer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/60 text-sm">{sortedPlayers.length} giocatori</span>
          </div>
          {/* Fase corrente */}
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
            phase === 'buzzed' ? 'bg-red-500/20 border-red-500/40 text-red-400' :
            phase === 'buzzer' ? 'bg-green-500/20 border-green-500/40 text-green-400' :
            phase === 'slide'  ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' :
            'bg-white/5 border-white/10 text-white/40'
          }`}>
            {phase === 'idle' ? '⏸ Idle' : phase === 'slide' ? '🎬 Slide' : phase === 'buzzer' ? '🔓 Buzzer Aperto' : '🚨 Buzzed!'}
          </div>
          <button id="host-logout-btn" onClick={() => setIsAuth(false)}
            className="text-white/30 hover:text-red-400 text-sm transition-colors px-2">Esci</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-6 overflow-x-auto">
        {[
          { id: 'game', label: '🎮 Partita' },
          { id: 'manche', label: '📋 Manche' },
          { id: 'round', label: '🎬 Slide Rapida' },
          { id: 'settings', label: '⚙️ Impostazioni' },
          { id: 'players', label: '👥 Giocatori' },
        ].map((tab) => (
          <button key={tab.id} id={`host-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${
              activeTab === tab.id ? 'border-red-500 text-red-400' : 'border-transparent text-white/40 hover:text-white/70'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ══ TAB PARTITA ══════════════════════════════════ */}
        {activeTab === 'game' && (
          <div className="flex flex-col gap-6 max-w-2xl mx-auto">

            {/* Pannello Buzzer attivo */}
            {phase === 'buzzed' && gameState?.buzzedBy && (
              <div className="animate-buzz-in glass p-6 border border-red-500/40 bg-red-500/10 rounded-2xl">
                <p className="section-title text-red-400/70">🚨 BUZZER ATTIVO</p>

                {/* Coda completa 1°/2°/3° */}
                <div className="flex flex-col gap-2 mb-5">
                  {[0, 1, 2].map((slot) => {
                    const p = (gameState.buzzQueue || [])[slot];
                    const isCurrent = slot === 0;
                    return (
                      <div key={slot} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                        isCurrent ? 'border-red-500/60 bg-red-500/15'
                        : p ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-white/5 bg-white/2 opacity-30'
                      }`}>
                        <span className="text-2xl w-8 text-center shrink-0">{ORDER_EMOJI[slot]}</span>
                        <div className="flex-1">
                          {p ? (
                            <>
                              <p className={`font-display font-black text-xl ${
                                isCurrent ? ORDER_COLOR[0] : 'text-white/70'
                              }`}>{p.name}</p>
                              {isCurrent && (
                                <p className="text-white/40 text-xs">
                                  +{pointsForOrder} pt &middot; −{gameState.settings?.penalty ?? 1} pt se sbaglia
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-white/20 text-sm italic">Slot libero</p>
                          )}
                        </div>
                        {isCurrent && p && (
                          <span className="text-xs px-2 py-1 rounded-full bg-red-500/30 text-red-300 font-semibold">Risponde</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button id="host-correct-btn" onClick={handleCorrect}
                    className="btn-success flex-1 py-4 text-lg font-display font-bold">✅ CORRETTO</button>
                  <button id="host-wrong-btn" onClick={handleWrong}
                    className="btn-danger flex-1 py-4 text-lg font-display font-bold">❌ SBAGLIATO</button>
                </div>
              </div>
            )}

            {/* Riapri Buzzer – quando coda esaurita e slide ancora attiva */}
            {(phase === 'slide') &&
             (gameState?.buzzedThisSlide?.length ?? 0) > 0 &&
             (gameState?.buzzQueue?.length ?? 0) === 0 && (
              <div className="glass p-5 border border-amber-500/30 bg-amber-500/5 rounded-2xl animate-fade-in">
                <p className="section-title text-amber-400/70">🔁 TUTTI HANNO RISPOSTO</p>
                <p className="text-white/50 text-sm mb-4">
                  Tutti i prenotati ({gameState.buzzedThisSlide.length}) hanno già giocato.
                  Riapri il buzzer per permettere agli altri di prenotarsi.
                </p>
                <button id="host-reopen-buzzer-btn" onClick={handleReopenBuzzer}
                  className="btn-primary w-full py-3 font-display font-bold">
                  🔓 RIAPRI BUZZER
                </button>
              </div>
            )}

            {/* Slide attiva – controlli */}
            {(phase === 'slide' || phase === 'buzzer') && (
              <div className="glass p-5 border border-purple-500/30 bg-purple-500/5 rounded-2xl">
                <p className="section-title text-purple-400/70">🎬 SLIDE ATTIVA</p>
                {gameState?.currentSlide?.title && (
                  <p className="font-display font-bold text-xl text-white mb-3 flex items-center flex-wrap gap-2">
                    "{gameState.currentSlide.title}"
                    {gameState.currentSlide.isDoublePoints && <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full uppercase tracking-wider font-black">Punti Doppi</span>}
                  </p>
                )}
                {mancheSlide?.hostNote && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <span className="text-yellow-400 text-sm">🔒</span>
                    <p className="text-yellow-300/90 text-sm font-semibold">{mancheSlide.hostNote}</p>
                  </div>
                )}
                {gameState?.currentSlide?.mediaType === 'image' && gameState?.currentSlide?.imageData && (
                  <img src={gameState.currentSlide.imageData} className="w-full max-h-40 object-contain rounded-xl mb-3 opacity-70" alt="slide" />
                )}
                {gameState?.currentSlide?.mediaType === 'text' && gameState?.currentSlide?.text && (
                  <p className="text-white/60 text-sm mb-3 italic">"{gameState.currentSlide.text}"</p>
                )}
                <div className="flex gap-3">
                  {phase === 'slide' && (
                    <button id="host-open-buzzer-btn" onClick={handleOpenBuzzer}
                      className="btn-success flex-1 py-3 font-display font-bold">
                      🔓 APRI BUZZER
                    </button>
                  )}
                  {phase === 'buzzer' && (
                    <div className="flex-1 text-center py-3 text-green-400 font-semibold text-sm">
                      ✅ Buzzer aperto – {(gameState?.buzzQueue || []).length}/3 prenotati
                      {(gameState?.buzzedThisSlide?.length ?? 0) > 0 && (
                        <span className="block text-white/30 text-xs mt-0.5">
                          {gameState.buzzedThisSlide.length} già bloccati
                        </span>
                      )}
                    </div>
                  )}
                  <button id="host-hide-slide-btn" onClick={handleHideSlide}
                    className="btn-secondary px-4 py-3 text-sm">
                    ✖ Chiudi Slide
                  </button>
                </div>
              </div>
            )}

            {/* Stato idle */}
            {phase === 'idle' && !loadedManche && (
              <div className="glass p-5 text-center border border-white/5 rounded-2xl">
                <p className="text-white/30 font-body">
                  Vai su <strong className="text-white/50">📋 Manche</strong> per caricare un progetto
                </p>
              </div>
            )}

            {/* ── Manche caricata: controlli ── */}
            {loadedManche && (
              <div className="glass p-5 border border-indigo-500/30 bg-indigo-500/5 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="section-title text-indigo-400/70 mb-0">📋 {loadedManche.name || 'Manche'}</p>
                    <p className="text-white/40 text-xs">{loadedManche.slides.length} slide totali</p>
                  </div>
                  <button onClick={handleUnloadManche}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 text-xs border border-white/10 transition-all">
                    ✕ Scarica
                  </button>
                </div>

                {/* Lista slide mini */}
                <div className="flex flex-col gap-1.5 mb-4 max-h-48 overflow-y-auto pr-1">
                  {loadedManche.slides.map((s, i) => (
                    <button key={s.id}
                      onClick={() => launchMancheSlide(i)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                        i === mancheSlideIdx && phase !== 'idle'
                          ? 'bg-red-500/20 border border-red-500/40 text-white'
                          : i === mancheSlideIdx
                          ? 'bg-indigo-500/15 border border-indigo-500/30 text-white'
                          : 'bg-white/5 border border-white/5 text-white/50 hover:bg-white/10'
                      }`}>
                      <span className="w-5 h-5 rounded text-xs flex items-center justify-center bg-white/10 font-bold shrink-0">{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">{s.title || `Slide ${i+1}`}</span>
                        {s.hostNote && <span className="block truncate text-yellow-400/70 text-xs">🔒 {s.hostNote}</span>}
                      </div>
                      <span className="text-xs opacity-60 shrink-0">
                        {s.mediaType === 'audio' ? '🎵' : s.mediaType === 'image' ? '🖼️' : '📝'}
                        {s.audioBlob ? ' 🔊' : ''}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Controlli navigazione */}
                <div className="flex gap-2">
                  <button onClick={() => launchMancheSlide(mancheSlideIdx - 1)}
                    disabled={mancheSlideIdx <= 0}
                    className="btn-secondary flex-1 py-3 text-sm font-semibold disabled:opacity-20">⬅ Prec</button>
                  <button onClick={() => launchMancheSlide(mancheSlideIdx)}
                    className="btn-primary flex-1 py-3 text-sm font-display font-bold">
                    🎬 Lancia Slide {mancheSlideIdx + 1}
                  </button>
                  <button onClick={() => launchMancheSlide(mancheSlideIdx + 1)}
                    disabled={mancheSlideIdx >= loadedManche.slides.length - 1}
                    className="btn-secondary flex-1 py-3 text-sm font-semibold disabled:opacity-20">Succ ➡</button>
                </div>

                {/* Controlli audio manche */}
                {mancheSlide?.audioBlob && mancheAudioRef.current && (
                  <div className="mt-3 p-4 bg-black/20 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white/50 text-sm font-semibold">Tempo Trascorso:</span>
                      <span className="text-emerald-400 font-display font-black text-2xl">
                        {audioTime.toFixed(1)}s
                      </span>
                    </div>
                    
                    <div className="flex gap-3 items-center mb-4">
                      <input 
                        type="number" 
                        placeholder="Es. 3" 
                        value={stopAtInput}
                        onChange={handleStopAtChange}
                        className="input-base py-2 px-3 w-24 text-center text-lg font-bold"
                        step="0.5"
                      />
                      <span className="text-white/40 text-sm leading-tight">
                        Ferma automaticamente<br/>dopo X secondi
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={handleManchePause}
                        className="btn-secondary flex-1 py-2 text-sm font-semibold">⏸ Pausa</button>
                      <button onClick={handleMancheResume}
                        className="btn-secondary flex-1 py-2 text-sm font-semibold">▶ Riprendi</button>
                      <button onClick={() => { if(mancheAudioRef.current) { mancheAudioRef.current.currentTime = 0; setAudioTime(0); mancheAudioRef.current.play().catch(()=>{}); } }}
                        className="btn-secondary flex-1 py-2 text-sm font-semibold border-amber-500/30 text-amber-400 hover:bg-amber-500/10">🔄 Riavvia</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Audio player (per slide rapide senza manche) */}
            {!loadedManche && (
              <AudioPlayer
                shouldPause={shouldPauseAudio}
                onPlayStateChange={(playing) => { if (!playing) setShouldPauseAudio(false); }}
              />
            )}

            {/* Classifica */}
            <div className="glass p-5">
              <p className="section-title">🏆 Classifica</p>
              <Scoreboard players={sortedPlayers} compact />
            </div>

            {/* Reset */}
            <div className="glass p-5 border border-white/10">
              <p className="section-title text-red-400/60">⚠️ Zona Pericolo</p>
              {!confirmReset ? (
                <div className="flex gap-3">
                  <button id="host-reset-scores-btn" onClick={() => setConfirmReset('scores')} className="btn-secondary flex-1 text-sm">🔄 Reset Punteggi</button>
                  <button id="host-reset-all-btn" onClick={() => setConfirmReset('all')} className="btn-secondary flex-1 text-sm">🗑️ Reset Completo</button>
                </div>
              ) : (
                <div className="animate-buzz-in flex flex-col gap-3">
                  <p className="text-red-400 text-sm text-center font-semibold">
                    {confirmReset === 'scores' ? 'Azzerare tutti i punteggi?' : 'Rimuovere tutti i giocatori?'}
                  </p>
                  <div className="flex gap-3">
                    <button id="host-confirm-reset-btn"
                      onClick={confirmReset === 'scores' ? handleResetScores : handleClearAll}
                      className="btn-danger flex-1">Sì, conferma</button>
                    <button id="host-cancel-reset-btn" onClick={() => setConfirmReset(false)} className="btn-secondary flex-1">Annulla</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB PREPARA ROUND ══════════════════════════════ */}
        {activeTab === 'round' && (
          <div className="max-w-xl mx-auto flex flex-col gap-5">

            {/* Opzione Punti Doppi Rapida */}
            <div className="glass p-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={slideIsDoublePoints}
                  onChange={(e) => setSlideIsDoublePoints(e.target.checked)}
                  className="w-5 h-5 accent-red-500"
                />
                <span className="text-red-400 font-bold text-lg">🔥 Punti Doppi</span>
              </label>
              <p className="text-white/30 text-xs mt-1 ml-8">Chi risponde correttamente o sbaglia prenderà il doppio dei punti/penalità</p>
            </div>

            {/* Titolo / Domanda */}
            <div className="glass p-5">
              <p className="section-title">❓ Titolo / Domanda</p>
              <input
                id="slide-title-input"
                type="text"
                value={slideTitle}
                onChange={(e) => setSlideTitle(e.target.value)}
                placeholder="Es. Di chi è questa canzone?"
                className="input-base"
              />
              <p className="text-white/30 text-xs mt-2">Verrà mostrato in grande sullo schermo TV e sul telefono dei giocatori</p>
            </div>

            {/* Tipo media */}
            <div className="glass p-5">
              <p className="section-title">📁 Tipo di Contenuto</p>
              <div className="flex gap-2">
                {[
                  { id: 'audio', label: '🎵 Musica', desc: 'Riproduci un brano' },
                  { id: 'image', label: '🖼️ Immagine', desc: 'Mostra una foto' },
                  { id: 'text', label: '📝 Testo', desc: 'Mostra del testo' },
                ].map((t) => (
                  <button
                    key={t.id}
                    id={`media-type-${t.id}`}
                    onClick={() => setSlideMediaType(t.id)}
                    className={`flex-1 py-3 px-2 rounded-xl border text-sm font-semibold transition-all ${
                      slideMediaType === t.id
                        ? 'border-red-500/60 bg-red-500/15 text-white'
                        : 'border-white/10 bg-white/5 text-white/40 hover:text-white/70'
                    }`}
                  >
                    <div className="text-xl mb-1">{t.label.split(' ')[0]}</div>
                    <div>{t.label.split(' ').slice(1).join(' ')}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Contenuto in base al tipo */}
            {slideMediaType === 'audio' && (
              <div className="glass p-5 border border-yellow-500/20 bg-yellow-500/5">
                <p className="section-title text-yellow-400/70">🎵 Musica</p>
                <p className="text-white/50 text-sm mb-3">
                  Carica il brano nel <strong className="text-white/70">player musicale</strong> nel tab Partita. <br/>
                  La slide mostrerà solo il titolo/domanda; l'audio lo controlli tu dall'host.
                </p>
                <div className="flex items-center gap-2 px-4 py-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <span className="text-yellow-400">💡</span>
                  <span className="text-yellow-300/70 text-sm">Avvia prima la slide, poi apri il buzzer quando vuoi</span>
                </div>
              </div>
            )}

            {slideMediaType === 'image' && (
              <div className="glass p-5">
                <p className="section-title">🖼️ Immagine</p>
                <label id="slide-image-upload" className="flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed border-white/20 hover:border-white/40 rounded-2xl p-6 transition-all">
                  {slideImagePreview ? (
                    <img src={slideImagePreview} className="max-h-48 rounded-xl object-contain" alt="preview" />
                  ) : (
                    <>
                      <div className="text-4xl">🖼️</div>
                      <p className="text-white/40 text-sm">Clicca per caricare un'immagine</p>
                      <p className="text-white/20 text-xs">JPG, PNG, GIF, WebP</p>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                {slideImagePreview && (
                  <button onClick={() => { setSlideImageData(null); setSlideImagePreview(null); }}
                    className="mt-3 w-full text-red-400/60 hover:text-red-400 text-sm transition-colors">
                    ✕ Rimuovi immagine
                  </button>
                )}
              </div>
            )}

            {slideMediaType === 'text' && (
              <div className="glass p-5">
                <p className="section-title">📝 Testo da Mostrare</p>
                <textarea
                  id="slide-text-input"
                  value={slideText}
                  onChange={(e) => setSlideText(e.target.value)}
                  placeholder="Es. Anno: 1975 / Artista italiano / Album: Premiata..."
                  rows={4}
                  className="input-base resize-none"
                />
                <p className="text-white/30 text-xs mt-2">Sarà mostrato sullo schermo TV come indizio</p>
              </div>
            )}

            {/* Bottoni azione */}
            <div className="flex gap-3">
              <button
                id="host-show-slide-btn"
                onClick={handleShowSlide}
                disabled={!slideTitle && slideMediaType === 'image' && !slideImageData}
                className="btn-primary flex-1 py-4 font-display font-bold text-lg"
              >
                🎬 MOSTRA SLIDE
              </button>
              {(phase === 'slide' || phase === 'buzzer' || phase === 'buzzed') && (
                <button id="host-hide-slide-from-round-btn" onClick={handleHideSlide}
                  className="btn-secondary px-4 py-4 text-sm">
                  ✖ Chiudi
                </button>
              )}
            </div>

            {/* Stato corrente */}
            {phase !== 'idle' && (
              <div className={`glass px-5 py-4 rounded-2xl text-center border ${
                phase === 'buzzer' ? 'border-green-500/30 bg-green-500/10' :
                phase === 'buzzed' ? 'border-red-500/30 bg-red-500/10' :
                'border-purple-500/30 bg-purple-500/10'
              }`}>
                <p className="text-white/60 text-sm">
                  Stato attuale: <strong className="text-white">{
                    phase === 'slide' ? '🎬 Slide mostrata, buzzer chiuso' :
                    phase === 'buzzer' ? '🔓 Buzzer aperto' :
                    '🚨 Qualcuno ha buzzato!'
                  }</strong>
                </p>
                {phase === 'slide' && (
                  <button id="host-open-buzzer-from-round-btn" onClick={handleOpenBuzzer}
                    className="mt-3 btn-success px-6 py-2 text-sm font-semibold">
                    🔓 Apri Buzzer Ora
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB MANCHE ══════════════════════════════════ */}
        {activeTab === 'manche' && (
          <MancheEditor onLoadManche={handleLoadManche} />
        )}

        {/* ══ TAB IMPOSTAZIONI ══════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="max-w-md mx-auto">
            <ScoreSettings
              settings={gameState?.settings}
              onSave={(s) => send({ type: 'UPDATE_SETTINGS', settings: s })}
            />
          </div>
        )}

        {/* ══ TAB GIOCATORI ═════════════════════════════════ */}
        {activeTab === 'players' && (
          <div className="max-w-md mx-auto glass p-5">
            <p className="section-title">👥 Giocatori ({sortedPlayers.length})</p>
            {sortedPlayers.length === 0 ? (
              <p className="text-white/30 text-center py-6">Nessun giocatore ancora...</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-white/40 font-display font-bold w-6 text-center">#{i + 1}</span>
                    <span className="flex-1 font-semibold">{p.name}</span>
                    <span className="font-display font-black text-xl">{p.score ?? 0}</span>
                    <div className="flex gap-1">
                      <button id={`player-minus-${p.id}`}
                        onClick={() => send({ type: 'UPDATE_SCORE', playerId: p.id, delta: -1 })}
                        className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors">−</button>
                      <button id={`player-plus-${p.id}`}
                        onClick={() => send({ type: 'UPDATE_SCORE', playerId: p.id, delta: 1 })}
                        className="w-7 h-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 flex items-center justify-center transition-colors">+</button>
                      <button id={`player-remove-${p.id}`}
                        onClick={() => send({ type: 'REMOVE_PLAYER', playerId: p.id })}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/20 hover:text-red-400 flex items-center justify-center transition-colors text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
