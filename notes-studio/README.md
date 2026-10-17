# Notes Studio

App Flutter (Android, iOS, Web) per prendere appunti a blocchi, in stile Notion.
Le note sono salvate solo sul dispositivo, in automatico mentre scrivi.

## Funzioni

**Editor a blocchi**
- Testo, Titolo 1/2/3, elenco puntato, elenco numerato, caselle da spuntare,
  elenco a scomparsa (toggle), citazione, callout con emoji e colore, codice,
  divisore, sottopagina
- Menu **"/"**: scrivi `/` all'inizio di una riga e scegli il tipo di blocco
  (filtra mentre scrivi, frecce + Invio da tastiera)
- **Scorciatoie Markdown**: `# ` `## ` `### ` `- ` `1. ` `[] ` `> ` (toggle)
  `" ` (citazione) `! ` (callout) ` ``` ` (codice) `---` (divisore)
- **Formattazione in linea**: `**grassetto**`, `*corsivo*`, `~~barrato~~`,
  `` `codice` `` visibili mentre scrivi (anche dai pulsanti B / I / S / codice e
  con Ctrl+B / Ctrl+I)
- Invio crea un nuovo blocco (e continua gli elenchi), Invio su una voce vuota
  esce dall'elenco, Backspace a inizio riga unisce al blocco precedente,
  Tab / Maiusc+Tab per i rientri
- Incollare più righe di Markdown crea direttamente i blocchi corrispondenti
- Rientri annidati: i blocchi rientrati sotto un toggle si chiudono con lui
- Trascina i blocchi tenendo premuto ⋮⋮ (si spostano insieme ai figli);
  tocca ⋮⋮ per trasformare, colorare, duplicare, spostare o eliminare
- Barra sopra la tastiera con tutte le azioni rapide (stile Notion mobile)
- 10 colori di testo / sfondo per blocco

**Pagine**
- Icona emoji, copertina a gradiente, titolo grande
- Sottopagine infinite, albero nella barra laterale con frecce di espansione
- Briciole di pane (percorso) nella barra in alto, tasto Indietro
- Preferiti, Duplica (con le sottopagine), Sposta in…, Cestino con ripristino
  ed eliminazione definitiva
- Ricerca in titoli e contenuti con anteprima del testo trovato
- Modelli: Cose da fare, Note riunione, Diario, Progetto, Ricetta, Lettura
- Esporta / condividi / copia in Markdown, incolla Markdown in fondo alla pagina
- Larghezza piena, informazioni (parole, blocchi, date)
- Tema chiaro, scuro o di sistema; su tablet/PC barra laterale sempre visibile

## Struttura

- `lib/models` — `Block` e `NotePage`, serializzati in JSON
- `lib/logic/editor_logic.dart` — logica pura dell'editor (scorciatoie, menu "/",
  numerazione, toggle, spostamenti, formattazione, Markdown)
- `lib/state` — `Workspace` (pagine, cestino, ricerca, salvataggio con
  `shared_preferences`) e i modelli di pagina
- `lib/widgets` — editor a blocchi, barra laterale, selettori
- `lib/screens` — schermata principale, ricerca, cestino

## Sviluppo

```bash
flutter pub get
flutter analyze
flutter test
flutter run
```

Le build per Android (APK) e iOS (IPA non firmata) si fanno con `codemagic.yaml`.
