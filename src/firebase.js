// ============================================================
// firebase.js – Configurazione Firebase
// ============================================================
// ISTRUZIONI:
// 1. Vai su https://console.firebase.google.com
// 2. Crea un nuovo progetto (es. "superbuzzer")
// 3. Aggiungi un'app Web al progetto
// 4. Copia la tua firebaseConfig qui sotto (sostituisci i placeholder)
// 5. Nelle regole del Realtime Database, imposta:
//    { "rules": { ".read": true, ".write": true } }
//    (oppure regole più restrittive in produzione)
// ============================================================

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyC1tWXzq-kOdA_vQejFW0HbguAkzDeXFtk",
  authDomain: "sarabanda-db45a.firebaseapp.com",
  // ⚠️ Controlla l'URL esatto nella console Firebase:
  // Build → Realtime Database → copia l'URL mostrato in cima (es. https://sarabanda-db45a-default-rtdb.europe-west1.firebasedatabase.app)
  databaseURL: "https://sarabanda-db45a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sarabanda-db45a",
  storageBucket: "sarabanda-db45a.firebasestorage.app",
  messagingSenderId: "131472134714",
  appId: "1:131472134714:web:1c56ffee8700b51a519b03"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
