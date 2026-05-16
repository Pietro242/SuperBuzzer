// AudioPlayer.jsx – Player audio per file MP3 locali
import { useEffect, useRef, useState } from 'react';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Props:
 *   shouldPause: boolean – l'Host passa true quando un giocatore buzzo
 *   onPlayStateChange: (isPlaying: boolean) => void
 */
export default function AudioPlayer({ shouldPause, onPlayStateChange }) {
  const audioRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [visualizer, setVisualizer] = useState(Array(20).fill(4));
  const vizIntervalRef = useRef(null);

  // Auto-pausa quando arriva il segnale
  useEffect(() => {
    if (shouldPause && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    }
  }, [shouldPause, onPlayStateChange]);

  // Animazione visualizer (simulata)
  useEffect(() => {
    if (isPlaying) {
      vizIntervalRef.current = setInterval(() => {
        setVisualizer(Array.from({ length: 20 }, () => Math.random() * 32 + 4));
      }, 100);
    } else {
      clearInterval(vizIntervalRef.current);
      setVisualizer(Array(20).fill(4));
    }
    return () => clearInterval(vizIntervalRef.current);
  }, [isPlaying]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.load();
    }
    setFileName(file.name.replace(/\.[^/.]+$/, ''));
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (!audioRef.current || !fileName) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      onPlayStateChange?.(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!isDragging && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    onPlayStateChange?.(false);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass p-5 flex flex-col gap-4">
      <p className="section-title">🎵 Player Musicale</p>

      {/* Upload */}
      <label
        id="audio-upload-btn"
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm text-white/70 group-hover:text-white transition-all whitespace-nowrap">
          📁 Carica MP3
        </div>
        <span className="text-white/50 text-sm truncate">
          {fileName || 'Nessun file selezionato'}
        </span>
        <input
          id="audio-file-input"
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {/* Visualizer */}
      <div className="flex items-end gap-0.5 h-10 px-1">
        {visualizer.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-100"
            style={{
              height: `${h}px`,
              background: isPlaying
                ? `hsl(${(i / 20) * 60 + 0}, 90%, 60%)`
                : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <input
          id="audio-progress"
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          className="w-full accent-red-500"
          style={{
            background: `linear-gradient(to right, #ef4444 ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-white/40 font-body">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controlli */}
      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          id="audio-play-pause-btn"
          onClick={togglePlay}
          disabled={!fileName}
          className={`
            w-14 h-14 rounded-full flex items-center justify-center text-2xl
            transition-all duration-200 hover:scale-110 active:scale-90
            ${fileName
              ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/30 cursor-pointer'
              : 'bg-white/10 cursor-not-allowed opacity-40'}
          `}
        >
          {isPlaying ? '⏸' : '▶️'}
        </button>

        {/* Volume */}
        <div className="flex items-center gap-2 flex-1">
          <span className="text-lg">{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
          <input
            id="audio-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 accent-red-500"
            style={{
              background: `linear-gradient(to right, #ef4444 ${volume * 100}%, rgba(255,255,255,0.15) ${volume * 100}%)`,
            }}
          />
        </div>
      </div>

      {/* Audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        style={{ display: 'none' }}
      />
    </div>
  );
}
