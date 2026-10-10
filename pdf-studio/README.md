# PDF Studio

App Flutter (Android, iOS, Web) per leggere e modificare PDF, ispirata a Xodo.

## Funzioni

**Lettore**
- Scorrimento continuo o a pagina singola, verticale o orizzontale
- Ricerca nel testo con risultato corrente / totale
- Segnalibri del documento, "vai a pagina", indicatore della pagina corrente
- Modalità notte (colori invertiti) e lettura a schermo intero
- Riapre i documenti all'ultima pagina letta

**Annotazioni**
- Evidenzia, sottolinea, barrato, ondulato, con 8 colori
- Note adesive
- Testo libero dove tocchi la pagina
- Firma a mano (salvabile e riutilizzabile) e inserimento di immagini
- Selezione ed eliminazione di un'annotazione, o rimozione di tutte

**Compilazione moduli**
- Riconosce i moduli PDF e permette di compilarli direttamente sulla pagina: testo, caselle, menu a tendina, scelte multiple, firma
- Pannello "Compila modulo" con tutti i campi in elenco, avanzamento, filtro "solo campi vuoti" e salto alla pagina del campo
- Compilazione automatica dal tuo profilo (nome, cognome, codice fiscale, nascita, indirizzo, CAP, città, telefono, email, azienda, P.IVA), salvato solo sul dispositivo
- Svuota modulo, appiattisci (i valori diventano testo fisso prima dell'invio), esporta e importa i dati (JSON, XFDF, FDF, XML)
- Per i PDF senza campi: strumenti Testo, Spunta ✓, Croce ✗ e Data di oggi, che restano attivi per compilare più punti di fila, con suggerimenti rapidi dal profilo

**Strumenti**
- Unisci PDF (scegli l'ordine), dividi (un file per pagina), estrai pagine (`1-3, 5, 8-`)
- Organizza pagine: riordina, ruota, elimina, aggiungi pagine vuote, estrai la selezione
- Da immagini a PDF e scansione con la fotocamera
- Comprimi, proteggi con password o rimuovila, filigrana, numera le pagine, ruota tutto
- Nuovo PDF vuoto, proprietà del documento

**Documenti**
- Recenti, Preferiti e Libreria, con ricerca per nome
- Rinomina, condividi, elimina
- Salva, Salva come, Esporta sul dispositivo, Condividi
- Tema chiaro, scuro o di sistema

## Sviluppo

```bash
flutter pub get
flutter analyze
flutter test
flutter run
```

Le build per Android (APK) e iOS (IPA non firmata) si fanno con `codemagic.yaml`.

Librerie usate: `syncfusion_flutter_pdfviewer` / `syncfusion_flutter_pdf`.
La licenza Syncfusion Community è gratuita per singoli sviluppatori e piccole aziende.
