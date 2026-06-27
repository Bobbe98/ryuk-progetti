# Compendio D&D 5e

Applicazione web per consultare bestiario e oggetti di D&D 5e, generare incontri casuali bilanciati per Grado di Sfida (GS) e ambiente, e generare negozi casuali in base al mestiere del mercante. Supporta sia contenuti ufficiali sia homebrew (creabili, modificabili ed eliminabili dall'utente).

## Stack

- **Server**: Node.js + Express, SQLite (`better-sqlite3`, file singolo, nessuna infrastruttura esterna richiesta).
- **Client**: React + Vite, React Router, Tailwind CSS v4.

## Scope dei contenuti e licenza (IMPORTANTE)

Il Manuale dei Mostri completo, gli oggetti magici non-SRD e le illustrazioni ufficiali Wizards of the Coast sono materiale protetto da copyright e **non possono essere redistribuiti** in un progetto di terze parti. Per questo l'applicazione utilizza i dati del **System Reference Document (SRD) 5.1**, rilasciato sotto **Open Game License (OGL)**, recuperati dalla API pubblica gratuita [dnd5eapi.co](https://www.dnd5eapi.co/) — l'unico sottoinsieme di contenuti "ufficiali" che può essere legalmente incluso per intero:

- 334 creature (intero bestiario SRD)
- 578 oggetti (341 oggetti magici + 237 equipaggiamento)

Le immagini vengono mostrate via hotlink diretto a dnd5eapi.co (nessuna immagine viene copiata o redistribuita dal server); quando un'illustrazione non esiste o non è disponibile, l'interfaccia mostra automaticamente un'icona segnaposto generata (gradiente + iniziali, deterministico per nome).

**Per i contenuti ufficiali oltre la SRD** (es. mostri/oggetti specifici del Manuale dei Mostri non coperti da OGL), l'app fornisce un sistema homebrew completo: chiunque può aggiungere manualmente nuove creature e oggetti tramite l'interfaccia, che vengono salvati nel proprio database locale e sono pienamente equivalenti ai contenuti SRD in tutte le funzionalità (filtri, generatore di incontri, generatore di negozi). Solo le voci homebrew possono essere modificate o eliminate; le voci SRD sono di sola lettura.

Dati non presenti nella SRD sono stati ricostruiti con regole homebrew dichiarate in-app:
- **Habitat/ambiente** delle creature: inferito euristicamente da tipo e parole chiave nella descrizione.
- **Materiali e procedura di creazione** degli oggetti: generati per categoria e rarità (le regole di crafting del DMG non sono OGL).
- **Costo** degli oggetti magici (assente nella SRD): generato in modo deterministico per fascia di rarità.

## Funzionalità

- **Bestiario**: ricerca, filtro per tipo/ambiente/GS, ordinamento, scheda completa (CA, PF, statistiche, salvezze, abilità, resistenze/immunità, sensi, linguaggi, tratti, azioni, azioni leggendarie, reazioni, habitat).
- **Oggetti**: ricerca, filtro per categoria/rarità, ordinamento, scheda completa (descrizione, rarità, costo, peso, sintonia, materiali e procedura di creazione).
- **Generatore di incontri**: per GS target (con ambiente opzionale) o per livello/dimensione gruppo/difficoltà, con calcolo budget PE e moltiplicatore per numero di creature.
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

## Note

- Il database è un singolo file SQLite in `server/data/app.db`; per re-inizializzare i dati SRD da zero è sufficiente eliminare il file e riavviare il server.
- Tutte le rotte API sono sotto `/api/{creatures,items,encounters,shops,meta}`.
