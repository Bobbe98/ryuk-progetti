# 🤖 Aiutante — bot Discord gratuito

Bot Discord in italiano che ti aiuta a **cercare informazioni**, **creare e sistemare server** e **moderare**.
Tutto gratis: ricerca web senza chiavi, AI con piani gratuiti (Groq o Google Gemini), nessun servizio a pagamento.

## Cosa sa fare

| Area | Comandi |
|---|---|
| 🤖 **AI e ricerca** | `/chiedi` (ricorda la chat del canale) · `/cerca` (Wikipedia + DuckDuckGo con riassunto AI e fonti) · `/traduci` · `/riassumi` (ultimi messaggi del canale) · `/ai-reset` · oppure **menziona il bot** per chattare |
| 🏗️ **Creare il server** | `/setup` crea ruoli + categorie + canali da un template (🌍 community, 🎮 gaming, 📚 studio, 💻 progetti, 🐉 D&D) · `/progetta-server` l'AI progetta la struttura su misura da una descrizione · `/crea-canale` (anche privato per un ruolo) · `/crea-ruolo` |
| 🩺 **Sistemare il server** | `/analizza-server` dà un punteggio di salute 0-100, elenca i problemi (permessi pericolosi di @everyone, verifica assente, filtro contenuti, canali senza categoria, categorie vuote, override rischiosi, ruolo del bot troppo in basso…), aggiunge consigli AI e con un bottone **corregge in automatico** quelli sicuri |
| 🛡️ **Moderazione** | `/pulisci` · `/timeout` · `/espelli` · `/banna` · `/blocca` · `/slowmode` |
| 🎉 **Community** | `/benvenuto` · `/autoruolo` · `/sondaggio` (sondaggi nativi) · `/promemoria` · `/utente` · `/info-server` · `/aiuto` |

Sicurezza: tutto ciò che crea o modifica il server mostra prima un'**anteprima con conferma**, rifà solo ciò che manca (non duplica
canali o ruoli esistenti), non assegna mai `Administrator` e i comandi admin sono visibili solo a chi ha i permessi giusti.

## Installazione (10 minuti)

### 1. Crea il bot su Discord
1. Vai su <https://discord.com/developers/applications> → **New Application** → dagli un nome.
2. **General Information** → copia l'**Application ID** (serve come `CLIENT_ID`).
3. **Bot** → **Reset Token** → copia il token (`DISCORD_TOKEN`). Non condividerlo con nessuno!
4. Sempre in **Bot**, sotto *Privileged Gateway Intents* attiva **MESSAGE CONTENT INTENT** e **SERVER MEMBERS INTENT**.
5. **OAuth2 → URL Generator**: spunta `bot` e `applications.commands`, poi come permessi **Administrator**
   (oppure, se preferisci il minimo indispensabile: Manage Roles, Manage Channels, Manage Server, Kick, Ban, Moderate Members,
   Manage Messages, Read Message History, Send Messages, Embed Links, Send Polls). Apri il link e aggiungi il bot al tuo server.
6. Nel server, trascina il ruolo del bot **in alto** nella lista ruoli (può gestire solo i ruoli sotto il suo).

### 2. Prendi una chiave AI gratuita (facoltativo ma consigliato)
- **Groq** (veloce, gratis): <https://console.groq.com/keys> → `GROQ_API_KEY`
- **Google Gemini** (gratis): <https://aistudio.google.com/apikey> → `GEMINI_API_KEY`

Basta una. Se le metti entrambe, se una fallisce il bot usa l'altra. Senza chiave funzionano comunque ricerca, template,
analisi del server, moderazione e community.

### 3. Avvia
Serve [Node.js](https://nodejs.org) 18 o superiore.

```bash
cd discord-bot
npm install
cp .env.example .env     # poi apri .env e incolla token, CLIENT_ID, GUILD_ID e la chiave AI
npm run deploy           # registra i comandi slash
npm start                # avvia il bot
```

`GUILD_ID` (tasto destro sul server → *Copia ID server*, con la modalità sviluppatore attiva) fa comparire i comandi
**subito** su quel server. Senza, i comandi sono globali e possono metterci fino a un'ora.

`npm run check` verifica offline che comandi e template siano validi.

## Tenerlo acceso 24/7 gratis

Un bot Discord deve restare sempre connesso. Opzioni gratuite:

- **Il tuo PC** — basta lasciare aperto `npm start` (o usare [pm2](https://pm2.keymetrics.io): `npx pm2 start src/index.js --name aiutante`).
- **Un vecchio telefono Android con Termux** — installa Termux da F-Droid, poi
  `pkg install nodejs git`, clona il repo e lancia `npm start`. Attiva "acquisisci wakelock" nella notifica di Termux.
- **Oracle Cloud Always Free** — una VM gratuita per sempre, ideale per tenerlo acceso: installa Node e usa pm2.
- **Docker** (su qualsiasi server): `docker build -t aiutante . && docker run -d --env-file .env -v $PWD/data:/app/data --restart unless-stopped aiutante`

## Struttura

```
src/
  index.js            avvio, eventi (comandi, bottoni, chat con menzione, benvenuto, promemoria)
  deploy-commands.js  registrazione comandi slash
  ai.js               Groq / Gemini con fallback e memoria della chat
  search.js           Wikipedia + DuckDuckGo (gratis, senza chiavi)
  plan.js             crea ruoli/categorie/canali da un "piano" (template o AI), con validazione
  templates.js        template pronti per /setup
  audit.js            analisi salute del server e correzioni automatiche
  storage.js          impostazioni per server e promemoria in data/*.json
  commands/           comandi divisi per area
```

Per aggiungere un comando: aggiungi un oggetto `{ data, execute }` nell'array `commands` di uno dei file in `src/commands/`,
poi `npm run deploy`. Per un nuovo template: aggiungi una voce in `src/templates.js`.
