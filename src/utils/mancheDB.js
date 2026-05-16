// mancheDB.js – IndexedDB per salvare manche e audio blob
const DB_NAME = 'SuperBuzzerDB';
const DB_VERSION = 1;
const STORE_MANCHE = 'manche';
const STORE_AUDIO = 'audio';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_MANCHE)) {
        db.createObjectStore(STORE_MANCHE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO, { keyPath: 'slideId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

function reqP(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Manche CRUD ─────────────────────────────────────────────

export async function getAllManche() {
  const db = await openDB();
  return reqP(tx(db, STORE_MANCHE).getAll());
}

export async function getManche(id) {
  const db = await openDB();
  return reqP(tx(db, STORE_MANCHE).get(id));
}

export async function saveManche(manche) {
  const db = await openDB();
  return reqP(tx(db, STORE_MANCHE, 'readwrite').put(manche));
}

export async function deleteManche(id) {
  const db = await openDB();
  // Elimina anche tutti gli audio associati
  const manche = await getManche(id);
  if (manche?.slides) {
    for (const slide of manche.slides) {
      await deleteAudio(slide.id);
      await deleteCorrectAudio(slide.id);
    }
  }
  return reqP(tx(db, STORE_MANCHE, 'readwrite').delete(id));
}

// ─── Audio Blob CRUD ─────────────────────────────────────────

export async function saveAudio(slideId, blob, fileName) {
  const db = await openDB();
  return reqP(tx(db, STORE_AUDIO, 'readwrite').put({ slideId, blob, fileName }));
}

export async function getAudio(slideId) {
  const db = await openDB();
  return reqP(tx(db, STORE_AUDIO).get(slideId));
}

export async function deleteAudio(slideId) {
  const db = await openDB();
  try {
    return reqP(tx(db, STORE_AUDIO, 'readwrite').delete(slideId));
  } catch { /* ignore */ }
}

export async function saveCorrectAudio(slideId, blob, fileName) {
  const db = await openDB();
  return reqP(tx(db, STORE_AUDIO, 'readwrite').put({ slideId: `correct_${slideId}`, blob, fileName }));
}

export async function getCorrectAudio(slideId) {
  const db = await openDB();
  return reqP(tx(db, STORE_AUDIO).get(`correct_${slideId}`));
}

export async function deleteCorrectAudio(slideId) {
  const db = await openDB();
  try {
    return reqP(tx(db, STORE_AUDIO, 'readwrite').delete(`correct_${slideId}`));
  } catch { /* ignore */ }
}
