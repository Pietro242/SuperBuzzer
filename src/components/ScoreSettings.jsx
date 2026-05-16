// ScoreSettings.jsx – Pannello impostazioni punti per l'Host
import { useState, useEffect } from 'react';

export default function ScoreSettings({ settings, onSave }) {
  const [form, setForm] = useState({
    points1st: settings?.points1st ?? 3,
    points2nd: settings?.points2nd ?? 2,
    points3rd: settings?.points3rd ?? 1,
    penalty: settings?.penalty ?? 1,
    hostPin: settings?.hostPin ?? '1234',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      points1st: settings?.points1st ?? 3,
      points2nd: settings?.points2nd ?? 2,
      points3rd: settings?.points3rd ?? 1,
      penalty: settings?.penalty ?? 1,
      hostPin: settings?.hostPin ?? '1234',
    });
  }, [settings]);

  const handleChange = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = async () => {
    await onSave({
      points1st: Number(form.points1st),
      points2nd: Number(form.points2nd),
      points3rd: Number(form.points3rd),
      penalty: Number(form.penalty),
      hostPin: form.hostPin,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const PointInput = ({ id, label, emoji, color, value, onChange }) => (
    <div className="flex items-center gap-3">
      <span className="text-2xl w-8 text-center shrink-0">{emoji}</span>
      <label htmlFor={id} className="text-white/60 text-sm font-body flex-1 min-w-0">{label}</label>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onChange(Math.max(0, Number(value) - 1))}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition-colors"
        >−</button>
        <input
          id={id}
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-14 text-center font-display font-black text-xl bg-transparent border-b-2 ${color} text-white focus:outline-none pb-1`}
        />
        <button
          onClick={() => onChange(Number(value) + 1)}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition-colors"
        >+</button>
      </div>
    </div>
  );

  return (
    <div className="glass p-5 flex flex-col gap-5">
      <p className="section-title">⚙️ Impostazioni Punti</p>

      <div className="flex flex-col gap-4">
        <PointInput
          id="points-1st"
          label="Punti 1° che indovina"
          emoji="🥇"
          color="border-yellow-400"
          value={form.points1st}
          onChange={(v) => handleChange('points1st', v)}
        />
        <PointInput
          id="points-2nd"
          label="Punti 2° che indovina"
          emoji="🥈"
          color="border-gray-400"
          value={form.points2nd}
          onChange={(v) => handleChange('points2nd', v)}
        />
        <PointInput
          id="points-3rd"
          label="Punti 3° che indovina"
          emoji="🥉"
          color="border-orange-400"
          value={form.points3rd}
          onChange={(v) => handleChange('points3rd', v)}
        />

        <div className="border-t border-white/10 pt-4">
          <PointInput
            id="penalty-points"
            label="Penalità risposta sbagliata"
            emoji="❌"
            color="border-red-400"
            value={form.penalty}
            onChange={(v) => handleChange('penalty', v)}
          />
        </div>

        {/* PIN Host */}
        <div className="border-t border-white/10 pt-4">
          <p className="section-title">🔐 PIN Host</p>
          <input
            id="host-pin-input"
            type="text"
            value={form.hostPin}
            onChange={(e) => handleChange('hostPin', e.target.value)}
            maxLength={8}
            className="input-base text-center font-display font-bold text-2xl tracking-[0.5em]"
            placeholder="1234"
          />
        </div>
      </div>

      <button
        id="save-settings-btn"
        onClick={handleSave}
        className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-300 ${
          saved
            ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
            : 'btn-primary'
        }`}
      >
        {saved ? '✅ Salvato!' : '💾 Salva Impostazioni'}
      </button>
    </div>
  );
}
