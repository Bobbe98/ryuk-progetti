# Compendio D&D 5e

Applicazione web per consultare bestiario e oggetti di D&D 5e, generare incontri casuali bilanciati per Grado di Sfida (GS) e ambiente, e generare negozi casuali in base al mestiere del mercante. Supporta sia contenuti ufficiali sia homebrew (creabili, modificabili ed eliminabili dall'utente).

## Stack

- **Server**: Node.js + Express, SQLite (`better-sqlite3`, file singolo, nessuna infrastruttura esterna richiesta).
- **Client**: React + Vite, React Router, Tailwind CSS v4.

## Scope dei contenuti e licenza (IMPORTANTE)

Il Manuale dei Mostri completo, gli oggetti magici non-SRD e le illustrazioni ufficiali Wizards of the Coast sono materiale protetto da copyright e **non possono essere redistribuiti** in un progetto di terze parti. Per questo l'applicazione utilizza i dati del **System Reference Document (SRD) 5.1**, rilasciato sotto **Open Game License (OGL)**, recuperati dalla API pubblica gratuita [dnd5eapi.co](https://www.dnd5eapi.co/) — l'unico sottoinsieme di contenuti "ufficiali" che può essere legalmente incluso per intero:

- 334 creature (intero bestiario SRD)
- 578 oggetti (341 oggetti magici + 237 equipaggiamento)
- 319 incantesimi (intera lista SRD, con i testi della **traduzione italiana ufficiale della SRD 5.1** pubblicata da Wizards of the Coast sotto licenza Creative Commons Attribution 4.0)

Le immagini ufficiali vengono mostrate via hotlink diretto a dnd5eapi.co (nessuna immagine viene copiata o redistribuita dal server); per tutte le voci senza illustrazione ufficiale (la maggior parte degli oggetti e le creature homebrew), l'app mostra un'icona tematica dedicata scelta in base al nome e alla categoria, su sfondo a gradiente deterministico. Le icone provengono da [game-icons.net](https://game-icons.net) (licenza **CC BY 3.0** — autori: Lorc, Delapouite, Skoll, DarkZaitzev, Faithtoken, Carl Olsen, sbed, Willdabeast, Lucas, Zajkonur e altri) e sono incluse nell'app (`client/src/assets/game-icons/`), quindi funzionano anche offline.

**Per i contenuti ufficiali oltre la SRD** (es. mostri/oggetti specifici del Manuale dei Mostri non coperti da OGL), l'app fornisce un sistema homebrew completo: chiunque può aggiungere manualmente nuove creature e oggetti tramite l'interfaccia, che vengono salvati nel proprio database locale e sono pienamente equivalenti ai contenuti SRD in tutte le funzionalità (filtri, generatore di incontri, generatore di negozi). Solo le voci homebrew possono essere modificate o eliminate; le voci SRD sono di sola lettura.

Dati non presenti nella SRD sono stati ricostruiti con regole homebrew dichiarate in-app:
- **Habitat/ambiente** delle creature: inferito euristicamente da tipo e parole chiave nella descrizione.
- **Materiali e procedura di creazione** degli oggetti: generati per categoria e rarità (le regole di crafting del DMG non sono OGL).
- **Costo** degli oggetti magici (assente nella SRD): generato in modo deterministico per fascia di rarità.

## Funzionalità

- **Bestiario**: ricerca, filtro per tipo/ambiente/GS, ordinamento, scheda completa (CA, PF, statistiche, salvezze, abilità, resistenze/immunità, sensi, linguaggi, tratti, azioni, azioni leggendarie, reazioni, habitat).
- **Oggetti**: ricerca, filtro per categoria/rarità, ordinamento, scheda completa (descrizione, rarità, costo, peso, sintonia, materiali e procedura di creazione).
- **Generatore di incontri**: per GS target (con ambiente opzionale) o per livello/dimensione gruppo/difficoltà, con calcolo budget PE e moltiplicatore per numero di creature.
- **Incantesimi**: tutti gli incantesimi SRD in italiano ufficiale, con filtri per classe, livello, scuola, rituali e concentrazione.
- **Tiradadi integrato**: ogni formula (es. `2d6+3`) nelle schede è cliccabile e tira i dadi; vassoio flottante con dadi rapidi, formule personalizzate e storico dei tiri.
- **Preferiti e liste di preparazione**: stella su creature/oggetti/incantesimi e liste personalizzate (es. per sessione), salvate sul dispositivo.
- **Generatore di negozi**: inventario casuale coerente con rarità pesata per mestiere (fabbro, alchimista, incantatore, ecc.), con prezzi e quantità.
- **Homebrew**: creazione, modifica ed eliminazione di creature e oggetti personalizzati via form dedicati.

## Setup e avvio

### 1. Server

```bash
cd server
npm install
npm run fetch-srd   # scarica il dataset SRD da dnd5eapi.co (richiede connessione internet)
npm start            # al primo avvio semina automaticamente il database SQLite (server/data/app.db)
```

Il server ascolta su `http://localhost:4000` (override con `PORT`).

### 2. Client (sviluppo)

```bash
cd client
npm install
npm run dev
```

Il client di sviluppo è su `http://localhost:5173` e proxa le chiamate `/api` al server su `:4000`.

### 3. Build di produzione (opzionale)

```bash
cd client && npm run build
cd ../server && npm start
```

Se `client/dist` esiste, il server Express lo serve direttamente (SPA su un'unica porta, nessun proxy necessario).

## App Android

L'app è disponibile anche come app Android nativa: è un wrapper (Capacitor) che incorpora l'interfaccia React in una WebView e funziona **completamente offline**, senza bisogno del server Node. I 334 creature e 578 oggetti SRD sono incorporati direttamente nell'APK (`client/src/data/creatures.json` e `items.json`, esportati dal database del server con `node server/scripts/dumpOfflineData.mjs`), e tutta la logica di filtri/ordinamento/generazione incontri/generazione negozi è replicata lato client in `client/src/local/`. Le creature e gli oggetti homebrew creati nell'app vengono salvati sul telefono stesso (`localStorage`), non sul server.

Il rilevamento della piattaforma (`Capacitor.isNativePlatform()` in `client/src/api.js`) decide automaticamente la modalità: sull'APK Android viene usato il motore offline (`client/src/local/localApi.js`), mentre l'app web (browser, sviluppo o self-hosting) continua a usare le chiamate di rete al server Node configurabile da **Impostazioni**, come prima.

> Nota: poiché l'APK non contatta alcun server, la pagina Impostazioni su Android mostra solo un messaggio informativo (nessun indirizzo server da configurare). Il permesso `android.permission.INTERNET` e `usesCleartextTraffic` restano nel manifest solo per compatibilità futura, non sono più strettamente necessari con questa modalità.

### Generare/ricompilare l'APK

Il progetto Android nativo è in `client/android/` (generato con [Capacitor](https://capacitorjs.com/)). Per ricompilarlo dopo eventuali modifiche al frontend:

```bash
cd server && node scripts/dumpOfflineData.mjs   # rigenera client/src/data/*.json se i dati SRD sono cambiati
cd ../client
npm install
npm run build        # genera client/dist (incorpora i dati SRD nel bundle JS)
npx cap sync android  # copia la build nel progetto Android
cd android
./gradlew assembleDebug
```

L'APK di debug viene generato in `client/android/app/build/outputs/apk/debug/app-debug.apk` ed è installabile direttamente su un telefono Android (serve "Origini sconosciute"/"Installa app esterne" abilitato, essendo una build di debug non firmata per il Play Store).

Richiede Android SDK (platform 34, build-tools 34.0.0) e JDK 17+; in alternativa è possibile aprire `client/android` con Android Studio e usare Build > Build APK.

## Note

- Il database è un singolo file SQLite in `server/data/app.db`; per re-inizializzare i dati SRD da zero è sufficiente eliminare il file e riavviare il server.
- Tutte le rotte API sono sotto `/api/{creatures,items,encounters,shops,meta}`.
- Per consentire le chiamate dall'app Android (o da qualsiasi client su rete diversa da `localhost`), il server deve essere avviato su un'interfaccia raggiungibile dalla rete (di default Express ascolta su tutte le interfacce); assicurati che eventuali firewall non blocchino la porta `4000`.
