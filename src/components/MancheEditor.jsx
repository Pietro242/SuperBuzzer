// MancheEditor.jsx – Editor completo per creare/modificare manche
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getAllManche, getManche, saveManche, deleteManche,
  saveAudio, getAudio, deleteAudio,
  saveCorrectAudio, getCorrectAudio, deleteCorrectAudio,
} from '../utils/mancheDB';

function uid() { return crypto.randomUUID(); }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const EMPTY_SLIDE = () => ({
  id: uid(),
  title: '',
  hostNote: '',
  mediaType: 'audio',
  text: '',
  imageData: null,
  audioFileName: null,
  hasAudio: false,
  correctAudioFileName: null,
  hasCorrectAudio: false,
  isDoublePoints: false,
});

// ─────────────────────────────────────────────────────────────
export default function MancheEditor({ onLoadManche }) {
  const [mancheList, setMancheList] = useState([]);
  const [editing, setEditing] = useState(null); // manche object in edit
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const audioRefs = useRef({});

  // ─── Load all manche ────────────────────────────────
  const refresh = useCallback(async () => {
    const list = await getAllManche();
    setMancheList(list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ─── Crea nuova manche ──────────────────────────────
  const handleNew = async () => {
    const newManche = {
      id: uid(),
      name: '',
      slides: [EMPTY_SLIDE()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveManche(newManche);
    setEditing(newManche);
    await refresh();
  };

  // ─── Apri manche esistente ──────────────────────────
  const handleOpen = async (id) => {
    const m = await getManche(id);
    if (m) {
      // Carica i nomi audio salvati
      for (const s of m.slides) {
        const a = await getAudio(s.id);
        if (a) {
          s.audioFileName = a.fileName;
          s.hasAudio = true;
        }
        const ca = await getCorrectAudio(s.id);
        if (ca) {
          s.correctAudioFileName = ca.fileName;
          s.hasCorrectAudio = true;
        }
      }
      setEditing({ ...m });
    }
  };

  // ─── Salva manche ──────────────────────────────────
  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const toSave = {
      ...editing,
      updatedAt: Date.now(),
      slides: editing.slides.map(s => ({
        id: s.id,
        title: s.title,
        hostNote: s.hostNote || '',
        mediaType: s.mediaType,
        text: s.text,
        imageData: s.imageData,
        audioFileName: s.audioFileName,
        hasAudio: s.hasAudio,
        correctAudioFileName: s.correctAudioFileName,
        hasCorrectAudio: s.hasCorrectAudio,
        isDoublePoints: s.isDoublePoints || false,
      })),
    };
    await saveManche(toSave);
    await refresh();
    setSaving(false);
  };

  // ─── Elimina manche ────────────────────────────────
  const handleDelete = async (id) => {
    await deleteManche(id);
    setConfirmDel(null);
    if (editing?.id === id) setEditing(null);
    await refresh();
  };

  // ─── Carica manche in partita ──────────────────────
  const handleLoad = async (id) => {
    const m = await getManche(id);
    if (!m) return;
    // Carica blob audio per ogni slide
    const slides = [];
    for (const s of m.slides) {
      const audio = await getAudio(s.id);
      const caudio = await getCorrectAudio(s.id);
      slides.push({
        ...s,
        audioBlob: audio?.blob || null,
        audioFileName: audio?.fileName || s.audioFileName,
        correctAudioBlob: caudio?.blob || null,
        correctAudioFileName: caudio?.fileName || s.correctAudioFileName,
      });
    }
    onLoadManche({ ...m, slides });
  };

  // ─── Slide ops ─────────────────────────────────────
  const updateSlide = (slideId, patch) => {
    setEditing(prev => ({
      ...prev,
      slides: prev.slides.map(s => s.id === slideId ? { ...s, ...patch } : s),
    }));
  };

  const addSlide = () => {
    setEditing(prev => ({
      ...prev,
      slides: [...prev.slides, EMPTY_SLIDE()],
    }));
  };

  const removeSlide = (slideId) => {
    deleteAudio(slideId);
    deleteCorrectAudio(slideId);
    setEditing(prev => ({
      ...prev,
      slides: prev.slides.filter(s => s.id !== slideId),
    }));
  };

  const moveSlide = (idx, dir) => {
    setEditing(prev => {
      const arr = [...prev.slides];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, slides: arr };
    });
  };

  const duplicateSlide = (slide) => {
    const newSlide = { ...slide, id: uid(), audioFileName: null, hasAudio: false, correctAudioFileName: null, hasCorrectAudio: false, isDoublePoints: slide.isDoublePoints || false };
    setEditing(prev => ({
      ...prev,
      slides: [...prev.slides, newSlide],
    }));
  };

  // ─── Audio upload ──────────────────────────────────
  const handleAudioUpload = async (slideId, file) => {
    if (!file) return;
    await saveAudio(slideId, file, file.name);
    updateSlide(slideId, { audioFileName: file.name, hasAudio: true });
  };

  const handleRemoveAudio = async (slideId) => {
    await deleteAudio(slideId);
    updateSlide(slideId, { audioFileName: null, hasAudio: false });
  };

  const handleCorrectAudioUpload = async (slideId, file) => {
    if (!file) return;
    await saveCorrectAudio(slideId, file, file.name);
    updateSlide(slideId, { correctAudioFileName: file.name, hasCorrectAudio: true });
  };

  const handleRemoveCorrectAudio = async (slideId) => {
    await deleteCorrectAudio(slideId);
    updateSlide(slideId, { correctAudioFileName: null, hasCorrectAudio: false });
  };

  // ─── Image upload ──────────────────────────────────
  const handleImageUpload = async (slideId, file) => {
    if (!file) return;
    const b64 = await fileToBase64(file);
    updateSlide(slideId, { imageData: b64 });
  };

  // ─── Export & Import ────────────────────────────────
  const handleExport = async (mancheId) => {
    try {
      const m = await getManche(mancheId);
      if (!m) return;
      const exportData = { ...m, slides: [] };
      
      for (const s of m.slides) {
        const slideData = { ...s };
        
        if (s.hasAudio) {
          const a = await getAudio(s.id);
          if (a?.blob) {
            slideData._audioBase64 = await fileToBase64(a.blob);
          }
        }
        if (s.hasCorrectAudio) {
          const ca = await getCorrectAudio(s.id);
          if (ca?.blob) {
            slideData._correctAudioBase64 = await fileToBase64(ca.blob);
          }
        }
        exportData.slides.push(slideData);
      }
      
      const jsonString = JSON.stringify(exportData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${m.name || 'Manche'}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Errore durante l'esportazione.");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      
      const newMancheId = uid();
      const newManche = {
        ...importedData,
        id: newMancheId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        slides: [],
      };
      
      for (const s of importedData.slides) {
        const newSlideId = uid();
        const newSlide = { ...s, id: newSlideId };
        
        if (newSlide._audioBase64) {
          const res = await fetch(newSlide._audioBase64);
          const blob = await res.blob();
          await saveAudio(newSlideId, blob, newSlide.audioFileName || 'audio');
          delete newSlide._audioBase64;
          newSlide.hasAudio = true;
        }
        
        if (newSlide._correctAudioBase64) {
          const res = await fetch(newSlide._correctAudioBase64);
          const blob = await res.blob();
          await saveCorrectAudio(newSlideId, blob, newSlide.correctAudioFileName || 'audio');
          delete newSlide._correctAudioBase64;
          newSlide.hasCorrectAudio = true;
        }
        
        newManche.slides.push(newSlide);
      }
      
      await saveManche(newManche);
      await refresh();
      e.target.value = '';
    } catch (err) {
      console.error("Import error:", err);
      alert("Errore durante l'importazione. File non valido.");
    }
  };

  // ════════════════════════════════════════════════════
  // RENDER: Lista manche
  // ════════════════════════════════════════════════════
  if (!editing) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-black text-2xl text-white">📋 I Tuoi Progetti</h2>
            <p className="text-white/40 text-sm mt-1">Crea e gestisci le manche del quiz</p>
          </div>
          <div className="flex gap-2">
            <label className="btn-secondary px-5 py-3 font-display font-bold text-sm flex items-center gap-2 cursor-pointer border border-white/10 hover:border-white/30 transition-all">
              📥 Importa
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button id="manche-new-btn" onClick={handleNew}
              className="btn-primary px-5 py-3 font-display font-bold text-sm flex items-center gap-2">
              ➕ Nuova
            </button>
          </div>
        </div>

        {mancheList.length === 0 ? (
          <div className="glass p-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-white/40 text-lg mb-2">Nessuna manche creata</p>
            <p className="text-white/25 text-sm">Crea la tua prima manche per preparare il quiz!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mancheList.map(m => (
              <div key={m.id} className="glass p-5 flex items-center gap-4 group hover:border-white/20 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-lg text-white truncate">
                    {m.name || 'Manche senza nome'}
                  </p>
                  <p className="text-white/40 text-sm">
                    {m.slides?.length || 0} slide · Aggiornata {new Date(m.updatedAt).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleLoad(m.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-semibold border border-emerald-500/30 transition-all">
                    ▶ Carica
                  </button>
                  <button onClick={() => handleOpen(m.id)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-semibold border border-white/10 transition-all">
                    ✏️ Modifica
                  </button>
                  <button onClick={() => handleExport(m.id)}
                    className="px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-semibold border border-blue-500/30 transition-all"
                    title="Esporta progetto (JSON)">
                    💾 Esporta
                  </button>
                  {confirmDel === m.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDelete(m.id)}
                        className="px-3 py-2 rounded-xl bg-red-500/30 text-red-400 text-sm font-bold border border-red-500/40">Sì</button>
                      <button onClick={() => setConfirmDel(null)}
                        className="px-3 py-2 rounded-xl bg-white/5 text-white/40 text-sm border border-white/10">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(m.id)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 text-sm border border-white/10 transition-all">
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // RENDER: Editor manche
  // ════════════════════════════════════════════════════
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button onClick={() => { handleSave().then(() => setEditing(null)); }}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-semibold border border-white/10 transition-all">
          ← Indietro
        </button>
        <div className="flex-1" />
        <span className="text-white/30 text-xs">
          {editing.slides.length} slide
        </span>
        <button id="manche-save-btn" onClick={handleSave} disabled={saving}
          className="btn-primary px-5 py-2.5 font-display font-bold text-sm flex items-center gap-2">
          {saving ? '⏳ Salvo...' : '💾 Salva'}
        </button>
        <button onClick={() => handleLoad(editing.id)}
          className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-bold border border-emerald-500/30 transition-all">
          ▶ Carica in Partita
        </button>
      </div>

      {/* Nome manche */}
      <div className="glass p-5">
        <p className="section-title">📋 Nome del Progetto</p>
        <input
          id="manche-name-input"
          type="text"
          value={editing.name}
          onChange={(e) => setEditing(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Es. Manche 1 – Anni 80"
          className="input-base text-lg font-display font-bold"
        />
      </div>

      {/* Slides */}
      {editing.slides.map((slide, idx) => (
        <div key={slide.id}
          className="glass p-5 border border-white/10 hover:border-white/20 transition-all relative group">

          {/* Header slide */}
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center text-sm font-display font-bold border border-red-500/30">
              {idx + 1}
            </span>
            <p className="section-title mb-0 flex-1">
              {slide.title || `Slide ${idx + 1}`}
            </p>
            <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
              <button onClick={() => moveSlide(idx, -1)} disabled={idx === 0}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 flex items-center justify-center text-xs disabled:opacity-20 border border-white/10">↑</button>
              <button onClick={() => moveSlide(idx, 1)} disabled={idx === editing.slides.length - 1}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 flex items-center justify-center text-xs disabled:opacity-20 border border-white/10">↓</button>
              <button onClick={() => duplicateSlide(slide)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 flex items-center justify-center text-xs border border-white/10">📋</button>
              {editing.slides.length > 1 && (
                <button onClick={() => removeSlide(slide.id)}
                  className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 flex items-center justify-center text-xs border border-red-500/20">✕</button>
              )}
            </div>
          </div>

          {/* Titolo slide */}
          <input
            type="text"
            value={slide.title}
            onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
            placeholder="Domanda / Titolo della slide"
            className="input-base mb-3"
          />

          {/* Nota privata host */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <span className="text-yellow-400 text-sm shrink-0">🔒</span>
            <input
              type="text"
              value={slide.hostNote || ''}
              onChange={(e) => updateSlide(slide.id, { hostNote: e.target.value })}
              placeholder="Risposta / nota privata (solo tu la vedi)"
              className="flex-1 bg-transparent text-yellow-300/80 placeholder-yellow-500/30 text-sm outline-none"
            />
          </div>

          {/* Opzione Punti Doppi */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
            <label className="flex items-center gap-2 cursor-pointer w-full">
              <input
                type="checkbox"
                checked={slide.isDoublePoints || false}
                onChange={(e) => updateSlide(slide.id, { isDoublePoints: e.target.checked })}
                className="w-4 h-4 accent-red-500"
              />
              <span className="text-red-400 font-bold text-sm">🔥 Punti Doppi per questa slide</span>
            </label>
          </div>

          {/* Tipo media */}
          <div className="flex gap-2 mb-3">
            {[
              { id: 'audio', label: '🎵 Musica' },
              { id: 'image', label: '🖼️ Immagine' },
              { id: 'text', label: '📝 Testo' },
            ].map(t => (
              <button key={t.id}
                onClick={() => updateSlide(slide.id, { mediaType: t.id })}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  slide.mediaType === t.id
                    ? 'border-red-500/60 bg-red-500/15 text-white'
                    : 'border-white/10 bg-white/5 text-white/40 hover:text-white/70'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Contenuto in base al tipo */}
          {slide.mediaType === 'text' && (
            <textarea
              value={slide.text}
              onChange={(e) => updateSlide(slide.id, { text: e.target.value })}
              placeholder="Testo da mostrare sullo schermo..."
              rows={3}
              className="input-base resize-none mb-3"
            />
          )}

          {slide.mediaType === 'image' && (
            <div className="mb-3">
              {slide.imageData ? (
                <div className="relative">
                  <img src={slide.imageData} className="w-full max-h-32 object-contain rounded-xl bg-white/5" alt="preview" />
                  <button onClick={() => updateSlide(slide.id, { imageData: null })}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center">✕</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-white/15 hover:border-white/30 rounded-xl p-4 transition-all">
                  <span className="text-2xl">🖼️</span>
                  <span className="text-white/40 text-xs">Clicca per caricare</span>
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(slide.id, e.target.files[0])} className="hidden" />
                </label>
              )}
            </div>
          )}

          {/* Audio upload – sempre visibile per tutti i tipi */}
          <div className={`px-4 py-3 rounded-xl border transition-all ${
            slide.hasAudio
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white/3 border-white/10'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">{slide.hasAudio ? '🎵' : '🔇'}</span>
              <div className="flex-1 min-w-0">
                {slide.hasAudio ? (
                  <p className="text-emerald-400 text-sm font-semibold truncate">{slide.audioFileName}</p>
                ) : (
                  <p className="text-white/30 text-sm">Nessun audio associato</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <label className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-xs font-semibold cursor-pointer border border-white/10 transition-all">
                  {slide.hasAudio ? '🔄 Cambia' : '📂 Carica Audio'}
                  <input type="file" accept="audio/*"
                    onChange={(e) => handleAudioUpload(slide.id, e.target.files[0])}
                    className="hidden" />
                </label>
                {slide.hasAudio && (
                  <button onClick={() => handleRemoveAudio(slide.id)}
                    className="px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 text-xs border border-red-500/20 transition-all">
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Correct Audio upload */}
          <div className={`px-4 py-3 mt-3 rounded-xl border transition-all ${
            slide.hasCorrectAudio
              ? 'bg-blue-500/10 border-blue-500/30'
              : 'bg-white/3 border-white/10'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">{slide.hasCorrectAudio ? '✅🎵' : '✅🔇'}</span>
              <div className="flex-1 min-w-0">
                {slide.hasCorrectAudio ? (
                  <p className="text-blue-400 text-sm font-semibold truncate">{slide.correctAudioFileName}</p>
                ) : (
                  <p className="text-white/30 text-sm">Canzone Risposta Corretta</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <label className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-xs font-semibold cursor-pointer border border-white/10 transition-all">
                  {slide.hasCorrectAudio ? '🔄 Cambia' : '📂 Carica Audio Corretto'}
                  <input type="file" accept="audio/*"
                    onChange={(e) => handleCorrectAudioUpload(slide.id, e.target.files[0])}
                    className="hidden" />
                </label>
                {slide.hasCorrectAudio && (
                  <button onClick={() => handleRemoveCorrectAudio(slide.id)}
                    className="px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 text-xs border border-red-500/20 transition-all">
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Aggiungi slide */}
      <button id="manche-add-slide-btn" onClick={addSlide}
        className="glass p-4 text-center border-2 border-dashed border-white/15 hover:border-red-500/40 hover:bg-red-500/5 transition-all group">
        <span className="text-2xl group-hover:scale-110 inline-block transition-transform">➕</span>
        <p className="text-white/40 group-hover:text-white/60 text-sm font-semibold mt-1">Aggiungi Slide</p>
      </button>
    </div>
  );
}
