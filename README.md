# 📄 Ryuk Docs

App web per **leggere e modificare file PDF, Excel e Word** direttamente nel browser.
Tutto funziona in locale: i tuoi file **non vengono mai inviati su internet**.

## 🚀 Come si usa

Non serve installare nulla:

1. Scarica o clona questa cartella
2. Fai doppio clic su **`index.html`** (si apre nel browser)
3. Trascina un file nella pagina iniziale, oppure usa i pulsanti «Apri»

> In alternativa, per avviarla come un piccolo sito locale:
> `python3 -m http.server 8000` nella cartella del progetto, poi apri
> [http://localhost:8000](http://localhost:8000)

## 📱 Installala come app sul telefono (Android e iPhone)

Ryuk Docs è una **PWA** (Progressive Web App): non serve un APK dal Play Store.
Una volta pubblicata su GitHub Pages (succede in automatico grazie al workflow
incluso, oppure attivala da *Settings → Pages* del repository):

1. Apri l'indirizzo dell'app dal browser del telefono
   (es. `https://bobbe98.github.io/ryuk-progetti/`)
2. **Android (Chrome)**: menu ⋮ → **«Aggiungi a schermata Home»** / «Installa app»
3. **iPhone (Safari)**: pulsante Condividi → **«Aggiungi a Home»**

L'app compare con la sua icona 📄 tra le altre app, si apre a schermo intero
e **funziona anche offline** dopo la prima visita.

## 📊 Excel (.xlsx, .xls, .csv)

- Griglia stile Excel con **barra della formula**, più fogli, righe/colonne espandibili
- Motore di calcolo **HyperFormula** con **oltre 380 funzioni** di Excel:
  `SUM`, `AVERAGE`, `IF`, `VLOOKUP`, `XLOOKUP`, `INDEX`, `MATCH`, `COUNTIF`,
  `SUMIFS`, `PMT`, `IRR`, `TODAY`, `DATEDIF`, `CONCATENATE`, `ROUND`… e molte altre
- Pulsante **ƒx Funzioni**: elenco completo, con ricerca (anche con i nomi
  italiani più comuni: SOMMA → SUM, SE → IF, CERCA.VERT → VLOOKUP…)
  e descrizioni in italiano con esempi
- Le formule vengono **conservate** quando salvi in `.xlsx`
- Esportazione anche in **CSV**

**Nota:** le formule si scrivono con i nomi inglesi (come nel file .xlsx vero e
proprio): `=SUM(A1:A10)`, `=IF(A1>10;"alto";"basso")` → usa la **virgola** come
separatore: `=IF(A1>10,"alto","basso")`.

## 📝 Word (.docx)

- Apri documenti `.docx` (testo, titoli, elenchi, tabelle, immagini)
- Editor con grassetto, corsivo, sottolineato, colori, evidenziatore,
  allineamento, elenchi, collegamenti, stili di titolo
- Salva di nuovo in `.docx` oppure **stampa/salva in PDF**
- Contatore di parole e caratteri

## 📕 PDF

- Visualizza tutte le pagine del PDF
- **✏️ Aggiungi testo**: clicca sul punto della pagina dove vuoi scrivere
  (scegli dimensione e colore; puoi trascinare il testo per spostarlo)
- **🗑 Elimina pagine** e **↻ ruota pagine**
- **📋 Estrai testo** da tutto il documento (con pulsante Copia)
- **💾 Salva PDF** scarica una copia con tutte le modifiche applicate

## 🔧 Tecnologie

Tutte le librerie sono incluse nella cartella `vendor/` (funziona offline):

| Libreria | Uso |
|---|---|
| [HyperFormula](https://hyperformula.handsontable.com/) | Motore di calcolo delle formule Excel |
| [SheetJS](https://sheetjs.com/) | Lettura/scrittura .xlsx/.xls/.csv |
| [Mammoth](https://github.com/mwilliamson/mammoth.js) | Lettura .docx |
| [html-docx-js](https://github.com/evidenceprime/html-docx-js) | Scrittura .docx |
| [PDF.js](https://mozilla.github.io/pdf.js/) | Visualizzazione PDF |
| [pdf-lib](https://pdf-lib.js.org/) | Modifica e salvataggio PDF |
