// PlayerView.jsx – Vista Giocatore (/giocatore)
import { useState, useEffect, useCallback } from 'react';
import { useGameServer } from '../hooks/useGameServer';
import BuzzerButton from '../components/BuzzerButton';
import Scoreboard from '../components/Scoreboard';

const STORAGE_KEY = 'superbuzzer_player';
function generateId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function PlayerView() {
  const { connected, gameState, sortedPlayers, send } = useGameServer();
  const [player, setPlayer] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showScoreboard, setShowScoreboard] = useState(false);

  // Ripristina sessione
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setPlayer(p);
      } catch (_) {}
    }
  }, []);

  // Re-join quando connesso (per riconnessioni)
  useEffect(() => {
    if (connected && player) {
      send({ type: 'JOIN', id: player.id, name: player.name });
    }
  }, [connected, player, send]);

  const handleLogin = () => {
    const name = nameInput.trim();
    if (!name) { setLoginError('Inserisci il tuo nome!'); return; }
    if (name.length > 20) { setLoginError('Nome troppo lungo (max 20 caratteri)'); return; }
    const taken = sortedPlayers.some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (taken) { setLoginError('Nome già in uso!'); return; }
    const id = generateId();
    const newPlayer = { id, name };
    send({ type: 'JOIN', id, name });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPlayer));
    setPlayer(newPlayer);
    setLoginError('');
  };

  const handleBuzz = useCallback(() => {
    if (!player) return;
    if (gameState?.phase !== 'buzzer' && gameState?.phase !== 'buzzed') return;
    send({ type: 'BUZZ', playerId: player.id, playerName: player.name });
  }, [player, gameState, send]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
    setNameInput('');
  };

  const getBuzzerStatus = () => {
    if (!gameState) return 'blocked';
    const { phase, buzzedBy, buzzQueue, wrongPlayers, buzzedThisSlide } = gameState;
    if (wrongPlayers && wrongPlayers.includes(player?.id)) return 'wrong';
    
    const inQueue = (buzzQueue || []).some(p => p.id === player?.id);
    const isMine = buzzedBy?.id === player?.id;
    
    if (buzzedThisSlide?.includes(player?.id) && !inQueue && !isMine) {
      return 'already_buzzed';
    }

    if (phase === 'idle' || phase === 'slide') return 'waiting';
    if (phase === 'buzzer') {
      if ((buzzQueue || []).length >= 3) return 'blocked';
      return 'active';
    }
    if (phase === 'buzzed') {
      if (isMine) return 'mine';
      if (inQueue) return 'queued';
      if ((buzzQueue || []).length >= 3) return 'blocked';
      return 'active'; // può ancora prenotarsi
    }
    return 'blocked';
  };

  // ─── Connessione ───
  if (!connected) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-5xl mb-4">📡</div>
          <p className="text-white/40 font-body text-lg">Connessione al server...</p>
          <p className="text-white/20 text-sm mt-2">Assicurati che il server sia avviato</p>
        </div>
      </div>
    );
  }

  // ─── Login ───
  if (!player) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-red-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-orange-600/15 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 w-full max-w-sm animate-slide-up">
          <div className="text-center mb-10">
            <div className="text-7xl mb-4 animate-float">🎵</div>
            <h1 className="font-display font-black text-5xl text-white tracking-tight mb-2">
              SUPER<span className="text-red-500">BUZZER</span>
            </h1>
            <p className="text-white/40 font-body">Il quiz musicale in tempo reale</p>
          </div>
          <div className="glass p-8 flex flex-col gap-5">
            <div>
              <label className="section-title block mb-2">Il tuo nome</label>
              <input
                id="player-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => { setNameInput(e.target.value); setLoginError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Es. Marco, Sara..."
                maxLength={20}
                className="input-base text-center text-xl font-semibold"
                autoFocus
              />
              {loginError && (
                <p className="text-red-400 text-sm mt-2 text-center animate-shake">{loginError}</p>
              )}
            </div>
            <button id="player-login-btn" onClick={handleLogin}
              className="btn-primary w-full py-4 text-lg font-display font-bold">
              🎮 ENTRA IN PARTITA
            </button>
          </div>
          <p className="text-center text-white/20 text-xs mt-6">{sortedPlayers.length} giocatori connessi</p>
        </div>
      </div>
    );
  }

  // ─── Buzzer ───
  const status = getBuzzerStatus();
  const phaseLabel = {
    idle: 'In attesa dell\'host...',
    slide: "L'host sta mostrando una slide",
    buzzer: 'Premi quando sei pronto!',
    buzzed: null,
  }[gameState?.phase] ?? '';

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      <div className="fixed inset-0 pointer-events-none transition-all duration-700"
        style={{
          background: status === 'mine'
            ? 'radial-gradient(circle at 50% 40%, rgba(16,185,129,0.15) 0%, transparent 70%)'
            : status === 'active'
            ? 'radial-gradient(circle at 50% 40%, rgba(239,68,68,0.1) 0%, transparent 70%)'
            : 'none',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest">Giocatore</p>
          <p className="text-white font-display font-bold text-xl">{player.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button id="toggle-scoreboard-btn" onClick={() => setShowScoreboard((s) => !s)}
            className="text-white/40 hover:text-white transition-colors text-sm">
            {showScoreboard ? '⬆ Chiudi' : '🏆 Classifica'}
          </button>
          <button id="player-logout-btn" onClick={handleLogout}
            className="text-white/30 hover:text-red-400 transition-colors text-sm">
            Esci
          </button>
        </div>
      </header>

      {showScoreboard && (
        <div className="relative z-10 px-5 py-4 border-b border-white/5 animate-slide-up">
          <Scoreboard players={sortedPlayers} compact />
        </div>
      )}

      {/* Fase slide – info per il giocatore */}
      {gameState?.phase === 'slide' && gameState?.currentSlide?.title && (
        <div className="relative z-10 mx-5 mt-4 glass p-4 rounded-2xl border border-purple-500/30 bg-purple-500/10 animate-fade-in">
          <p className="text-purple-300 font-display font-bold text-lg text-center">
            {gameState.currentSlide.title}
          </p>
        </div>
      )}

      {/* Status messaggio */}
      {(gameState?.phase === 'idle' || gameState?.phase === 'slide') && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-5">
          <div className="text-6xl animate-float">
            {gameState?.phase === 'slide' ? '🎬' : '⏳'}
          </div>
          <div className="glass px-8 py-5 rounded-2xl text-center border border-white/10">
            <p className="text-white/60 text-lg font-body">{phaseLabel}</p>
          </div>
        </div>
      )}

      {/* Buzzer */}
      {(gameState?.phase === 'buzzer' || gameState?.phase === 'buzzed') && (
        <main className="relative z-10 flex flex-col flex-1 items-center justify-center px-5 py-6">
          <BuzzerButton
            status={status}
            onBuzz={handleBuzz}
            blockedByName={gameState?.buzzedBy?.name}
            queuePosition={(gameState?.buzzQueue || []).findIndex(p => p.id === player?.id) + 1}
          />
        </main>
      )}

      <footer className="relative z-10 pb-8 text-center">
        <p className="text-white/30 text-xs uppercase tracking-widest mb-1">Il tuo punteggio</p>
        <p className="font-display font-black text-4xl text-white">
          {sortedPlayers.find((p) => p.id === player.id)?.score ?? 0}
        </p>
      </footer>
    </div>
  );
}
