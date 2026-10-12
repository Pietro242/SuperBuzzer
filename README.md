# 🔔 SuperBuzzer

<div align="center">

![SuperBuzzer Banner](https://img.shields.io/badge/SuperBuzzer-Quiz%20Show%20Live-FF3366?style=for-the-badge&logo=soundcharts&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-WebSocket-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**Piattaforma interattiva per quiz musicali in tempo reale (stile *Sarabanda / Name That Tune*) con sistema di prenotazione a buzzer ultra-rapido su rete locale (LAN).**

[Panoramica](#-panoramica) •
[Ruoli e Viste](#-ruoli-e-viste) •
[Meccaniche di Gioco](#-meccaniche-di-gioco) •
[Come Avviare](#-guida-rapida-allavvio) •
[Configurazione LAN](#-collegamento-da-smartphone-e-tv-lan) •
[Architettura](#-architettura-tecnica) •
[Roadmap & Note](#-roadmap--funzionalità-in-arrivo)

</div>

---

## 📖 Panoramica

**SuperBuzzer** trasforma qualsiasi serata tra amici o evento in un vero quiz show televisivo.  
L'applicazione è progettata per funzionare **interamente offline in rete locale (LAN)** a bassissima latenza (< 10 ms), senza dipendenze cloud o abbonamenti esterni.

Un unico computer funge da **server centrale** e **regia**, mentre i giocatori si connettono istantaneamente dai propri smartphone via browser, e il pubblico/giocatori seguono l'azione su un maxischermo o TV.

---

## 🎭 Ruoli e Viste

L'applicazione dispone di 3 schermate dedicate accessibili via React Router:

| Vista | URL | Dispositivo consigliato | Descrizione |
|---|---|---|---|
| **Giocatore** | `/giocatore` o `/` | 📱 Smartphone | Pulsantone buzzer gigante, feedback visivo immediato di prenotazione, posizione in coda e classifica live. |
| **Host (Regia)** | `/host` | 💻 PC / Portatile | Dashboard completa protetta da PIN: controllo audio/slide, gestione coda prenotazioni, assegnazione punti/penalità, creazione manche. |
| **Schermo (TV)** | `/schermo` | 📺 TV / Proiettore | Grafica broadcast 16:9 ad alto impatto visivo con particelle, illuminazione d'ambiente reattiva alle fasi di gioco e podio. |

---

### 1. 📱 Vista Giocatore (`/giocatore`)
* **Registrazione istantanea:** basta inserire il proprio nickname (con controllo anti-duplicati e salvataggio sessione nel browser).
* **Buzzer reattivo:** pulsante a schermo intero con feedback tattile/visivo:
  * 🟢 **Attivo:** pronto per essere premuto non appena l'host apre la prenotazione.
  * 🟡 **In coda:** mostra la posizione esatta acquisita (1°, 2° o 3°).
  * 🔴 **Bloccato / Errato:** blocco automatico se si è già risposto in modo errato o se la coda è satura.
* **Classifica estraibile:** pulsante per consultare in qualsiasi momento la classifica generale con i punteggi aggiornati in tempo reale.

---

### 2. 👑 Vista Host / Regia (`/host`)
* **Protezione con PIN:** accesso protetto (PIN predefinito: `1234`, personalizzabile nelle impostazioni).
* **Player Audio Integrato:** riproduzione delle tracce musicali con seek bar, tempo trascorso e **interruzione automatica della musica** all'istante esatto in cui un giocatore preme il buzzer.
* **Timer "Stop automatico":** possibilità di impostare uno stop programmato (es. ferma l'audio a `12.5s` per far indovinare solo l'intro).
* **Gestione Coda & Punteggi:**
  * Visualizzazione in tempo reale di chi ha premuto per primo (e fino a 3 giocatori in coda).
  * Pulsanti rapidi **Corretta** (assegna punteggio a scalare) ed **Errata** (applica penalità e passa automaticamente al giocatore successivo in coda).
  * Gestione manuale del punteggio (+/-) per qualsiasi concorrente.
* **Manche & Slide Builder:**
  * Supporto per slide **Audio**, **Immagine** (con upload locale ad alta risoluzione) e **Testo**.
  * Opzione **Punti Doppi (x2)** per manche speciali o finali.
  * **Editor Manche integrato:** crea, riordina, salva su memoria locale (IndexedDB), esporta e importa set di domande in formato JSON.

---

### 3. 📺 Vista Schermo / TV (`/schermo`)
* **Regia Broadcast:** progettata per visualizzazione a tutto schermo su televisori, monitor secondari o videoproiettori.
* **Illuminazione dinamica:** il fondale reagisce allo stato di gioco:
  * 🟣 *Slide attiva:* atmosfera viola soft.
  * 🟢 *Buzzer aperto:* luce verde brillante (via libera alle prenotazioni!).
  * 🔴 *Buzzer premuto:* allarme visivo pulsante rosso fuoco con nome del concorrente a tutto schermo.
* **Podio & Top 5:** classifica live con medaglie animate per i primi tre classificati (🥇 🥈 🥉).

---

## ⚡ Meccaniche di Gioco

```
        ┌─────────────┐
        │    IDLE     │  (In attesa della domanda)
        └──────┬──────┘
               │ Host carica slide / traccia audio
               ▼
        ┌─────────────┐
        │    SLIDE    │  (I giocatori ascoltano / guardano)
        └──────┬──────┘
               │ Host apre il buzzer
               ▼
        ┌─────────────┐
   ┌───►│   BUZZER    │  (Buzzer verde aperto a tutti)
   │    └──────┬──────┘
   │           │ Il primo giocatore preme il buzzer (audio in pausa!)
   │           ▼
   │    ┌─────────────┐
   │    │   BUZZED    │  (Coda di max 3 concorrenti)
   │    └──────┬──────┘
   │           │
   │    ┌──────┴──────────────────────────┐
   │    ▼                                 ▼
   │ [Risposta ERRATA ❌]           [Risposta CORRETTA ✅]
   │ Penalità (-1 pt)               Punti assegnati (+3 / +2 / +1 pt)
   │ Chi sbaglia è escluso          Reset slide e ritorno a IDLE
   │ Passa al 2° in coda
   └─── (Se la coda finisce,
        l'host può riaprire)
```

1. **Prenotazione fino a 3 concorrenti:** quando un giocatore si prenota, gli altri possono comunque entrare come 2° o 3° di riserva.
2. **Punteggio scalare configurabile:**
   * 🥇 1° tentativo indovinato: **+3 punti** *(o custom)*
   * 🥈 2° tentativo indovinato: **+2 punti** *(o custom)*
   * 🥉 3° tentativo indovinato: **+1 punto** *(o custom)*
3. **Penalità per errore:** -1 punto *(custom)* e blocco definitivo per quella domanda (il giocatore non può ri-prenotarsi per la medesima slide).
4. **Moltiplicatore Punti Doppi:** raddoppia sia i punti assegnati che le penalità per le domande decisive.

---

## 🚀 Guida Rapida all'Avvio

### Prerequisiti
* [Node.js](https://nodejs.org/) (versione 18 o superiore consigliata)
* Computer e smartphone connessi alla **stessa rete Wi-Fi / LAN**.

### Installazione

Clona il repository (o scarica la cartella) ed installa le dipendenze:

```bash
git clone https://github.com/Pietro242/SuperBuzzer.git
cd SuperBuzzer
npm install
```

### Avvio dell'Applicazione

Puoi avviare sia il server WebSocket che il frontend con un solo comando:

```bash
npm run dev
```

> **Consiglio per il Debug:** se preferisci avere i log del server e del frontend separati, puoi aprire **due terminali**:
> 
> **Terminale 1 (Server WebSocket & Upload):**
> ```bash
> npm run server
> ```
> *(Ascolta su tutte le interfacce di rete `0.0.0.0:3001`)*
> 
> **Terminale 2 (Frontend React + Vite):**
> ```bash
> npx vite --host
> ```
> *(Espone il client web su porta `5173` per tutti i dispositivi in rete)*

---

## 📶 Collegamento da Smartphone e TV (LAN)

Per far partecipare i concorrenti dal proprio telefono:

1. **Trova l'indirizzo IP locale del tuo computer:**
   * **macOS:** *Impostazioni di Sistema → Wi-Fi → Dettagli* (oppure da terminale: `ipconfig getifaddr en0`)
   * **Windows:** da prompt dei comandi digita `ipconfig` e cerca *Indirizzo IPv4* (es. `192.168.1.50`)
   * **Linux:** `hostname -I`

2. **Accedi alle rispettive schermate:**
   * **Concorrenti (Smartphone):**
     ```text
     http://<IP-DEL-TUO-PC>:5173/giocatore
     ```
     *(Puoi generare un QR Code gratuito con questo link per farlo inquadrare ai giocatori)*
   * **Maxischermo / Proiettore:**
     ```text
     http://localhost:5173/schermo
     ```
   * **Host / Regista (PC):**
     ```text
     http://localhost:5173/host
     ```
     *PIN di default:* `1234`

> [!TIP]
> **Firewall:** se i telefoni non riescono a connettersi, assicurati che il Firewall di sistema (Windows Defender / macOS Firewall) consenta il traffico in ingresso sulle porte **5173** (HTTP) e **3001** (WebSocket).

---

## 🛠️ Architettura Tecnica

```
SuperBuzzer/
├── server.js               # Server Node.js (HTTP + WebSocket ws su porta 3001)
├── superbuzzer_save.json   # Persistenza automatica punteggi e impostazioni
├── src/
│   ├── App.jsx             # Router principale (pagine: /giocatore, /host, /schermo)
│   ├── pages/
│   │   ├── HostView.jsx    # Dashboard regia con player audio, media e impostazioni
│   │   ├── PlayerView.jsx  # Client concorrente per smartphone
│   │   └── ScreenView.jsx  # Schermo TV/Proiettore con animazioni e leaderboard
│   ├── components/
│   │   ├── AudioPlayer.jsx   # Gestore tracce audio con stop point
│   │   ├── BuzzerButton.jsx  # Pulsante buzzer animato ad alta responsività
│   │   ├── MancheEditor.jsx  # Editor visuale manche e domande
│   │   ├── Scoreboard.jsx    # Classifica giocatori
│   │   └── ScoreSettings.jsx # Modalità di personalizzazione punteggi/PIN
│   ├── hooks/
│   │   └── useGameServer.js  # Client WebSocket custom con auto-reconnect
│   └── utils/
│       ├── imageUpload.js    # Upload immagini in memoria server via HTTP
│       └── mancheDB.js       # Database IndexedDB locale per salvataggio manche
└── package.json
```

* **Zero Cloud:** Nessun servizio esterno o account necessario, i dati restano protetti e salvati in locale su `superbuzzer_save.json`.
* **Auto-riconnessione:** In caso di disconnessione Wi-Fi momentanea dello smartphone, il client ristabilisce il collegamento senza perdere punteggi o identità del concorrente.

---

## 🎯 Comandi NPM Disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia contemporaneamente il WebSocket server e Vite esposto in LAN |
| `npm run server` | Avvia solo il server WebSocket su porta `3001` |
| `npm run build` | Compila l'applicazione per la produzione in `dist/` |
| `npm run preview` | Esegue un'anteprima locale della build di produzione |
| `npm run lint` | Esegue il controllo del codice con ESLint |

---

## 🐛 Roadmap & Funzionalità in Arrivo

- [ ] 🔊 **Effetti Sonori (SFX):**
  - Suono all'apertura del buzzer (segnale di via libera).
  - Suono d'allarme quando scatta la prima prenotazione.
  - Suono di errore in caso di risposta errata.
- [ ] 📲 **QR Code Automatico:** visualizzazione del QR Code direttamente nella schermata TV per facilitare l'accesso ai nuovi giocatori.
- [ ] ⏱️ **Timer Risposta Concorrente:** conto alla rovescia (es. 5 secondi) a partire dal momento in cui il giocatore buzza.

---

## 📄 Licenza

Progetto distribuito ad uso personale e ricreativo. Divertiti con i tuoi quiz musicali! 🎶🎉
