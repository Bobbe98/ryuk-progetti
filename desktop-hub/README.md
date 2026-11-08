# Desktop Hub

App Android (Kotlin + Jetpack Compose) per **installare e usare programmi per computer sul
telefono**: Firefox, LibreOffice, GIMP, Inkscape, VS Code (Code - OSS), VLC e altri, più
programmi Windows semplici tramite Wine. Le app girano davvero sul telefono, senza root e
senza PC, e si vedono a tutto schermo dentro l'app.

## Come funziona

```
Desktop Hub ──RUN_COMMAND──▶ Termux (Linux)
   │                          ├─ pkg / apt          → installa le app
   │                          ├─ Hangover/Wine      → programmi .exe
   │                          └─ Xvnc :1 + XFCE/Fluxbox → schermo virtuale
   └── visualizzatore VNC integrato ◀── 127.0.0.1:5901 (solo locale, con password)
```

- **Termux** fa da motore Linux: installa le versioni ARM dei programmi desktop dai suoi
  repository (`x11-repo`).
- Il desktop gira su un **server X virtuale** (TigerVNC `Xvnc`) che ascolta solo in locale,
  protetto da una password casuale generata dall'app.
- L'app include un **client VNC scritto da zero** (`vnc/`) che mostra il desktop e
  traduce i gesti in mouse e tastiera.

## Uso

1. Installa **Termux** da F-Droid o GitHub.
2. Nella scheda *Inizia*: copia il comando che abilita il collegamento e incollalo in Termux.
3. Concedi il permesso "Esegui comandi in Termux".
4. Premi *Installa* per l'ambiente desktop (XFCE completo o Fluxbox leggero).
5. Scheda *App*: installa i programmi che vuoi e premi **Apri**.

### File del telefono

- Dopo aver consentito l'accesso ai file (passaggio 5), sul desktop compaiono le cartelle
  **Telefono** (memoria interna) e **Download**, anche tra i segnalibri del file manager;
  in Wine la memoria del telefono è l'unità **D:**.
- **Apri file dal telefono** (schermata principale o barra del desktop): scegli un file con il
  selettore di Android; viene copiato in `Download/DesktopHub/` e aperto nel desktop.
  `.exe`, `.msi`, `.bat` si aprono con Wine (comando `hangover-wine`) (es. per installare un programma Windows), gli
  altri file con il programma predefinito.

Con il pulsante *Aggiungi* si può installare qualsiasi altro pacchetto Termux
(`pkg search nome` per cercarlo) indicando il comando di avvio.

### Comandi nel desktop

| Gesto | Tocco diretto | Touchpad |
|---|---|---|
| Tocca | clic sinistro dove tocchi | clic sinistro sul puntatore |
| Trascina | trascina con il tasto sinistro | muove il puntatore |
| Tieni premuto | clic destro | inizia un trascinamento |
| Due dita: tocca | clic destro | clic destro |
| Due dita: scorri | rotella del mouse (con zoom: sposta la vista) | idem |
| Pizzica | zoom | zoom |

La barra in basso ha tastiera, Esc, Tab, Ctrl/Alt/Win (a scatto, valgono per il tasto
successivo), frecce, Canc, F11, *Incolla dal telefono* (copia gli appunti del telefono nel
desktop e preme Ctrl+V), cambio modalità e adatta allo schermo. Il testo copiato nel desktop
finisce negli appunti del telefono.

## Limiti

- Servono spazio (da ~500 MB a qualche GB) e connessione per scaricare i programmi.
- Le prestazioni dipendono dal telefono; senza accelerazione 3D i programmi pesanti e i
  giochi vanno lenti.
- Wine/Hangover (programmi Windows) è sperimentale, solo per Termux a 64 bit (aarch64), e
  occupa circa 2,4 GB una volta installato.
- Android 12+ può chiudere i processi di Termux ("phantom process killer"): vedi i consigli
  nella scheda *Inizia*.

## Nomi dei pacchetti

I nomi dei pacchetti e dei comandi del catalogo sono verificati sugli indici reali dei
repository di Termux (`Packages` e `Contents-aarch64`). Attenzione: in Termux `xdg-open`
apre i file nelle app Android; nel desktop si usano `exo-open` o `xdg-utils-xdg-open`.

## Struttura

- `termux/TermuxBridge.kt` — invio comandi a Termux (`RUN_COMMAND`), in un terminale visibile
  o in background con risultato via `PendingIntent` (`TermuxResultReceiver`).
- `termux/Scripts.kt` — script bash per configurazione, installazione, avvio/arresto del
  desktop e stato delle app.
- `data/AppCatalog.kt` — catalogo delle app; `data/Settings.kt` — preferenze, risoluzione,
  ambiente desktop, app personalizzate.
- `vnc/RfbClient.kt` — protocollo RFB 3.3/3.7/3.8 (auth VNC, encoding Raw, CopyRect,
  DesktopSize); `vnc/Des.kt` — DES per l'autenticazione VNC; `vnc/RemoteDesktopView.kt` —
  disegno, zoom, gesti, tastiera; `vnc/KeySyms.kt` — codici tasto X11.
- `MainActivity.kt` + `ui/` — schermate Inizia, App, Impostazioni; `ViewerActivity.kt` —
  desktop a schermo intero.

## Build

Richiede Android SDK (compileSdk 34, minSdk 26) e JDK 17+.

```bash
cd desktop-hub
./gradlew :app:testDebugUnitTest   # test (DES, sintassi bash di tutti gli script)
./gradlew :app:assembleRelease     # APK in app/build/outputs/apk/release/
```

Test di integrazione con un vero server VNC (facoltativo, richiede TigerVNC):

```bash
Xvnc :1 -geometry 1280x592 -localhost -rfbport 5901 -rfbauth ~/.vnc/passwd &
LIVE_VNC=1 VNC_PW=<password> OUT_DIR=/tmp ./gradlew :app:testDebugUnitTest --tests '*LiveVncTest*'
```
