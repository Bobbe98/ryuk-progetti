# Ryuk Automation

App Android (Kotlin + Jetpack Compose) per creare automazioni generiche del tipo
**trigger → condizioni → azioni**, sullo stile di Tasker/MacroDroid.

## Funzionalità

**Trigger** (eventi che avviano un'automazione):
- Ora del giorno (con giorni della settimana)
- Livello batteria (sopra/sotto soglia)
- Stato carica (collegato/scollegato)
- Stato Wi-Fi (connesso/disconnesso, opzionalmente per SSID)
- Stato schermo (acceso/spento)
- App avviata
- Notifica ricevuta (per app e/o testo contenuto)
- Avvio del dispositivo
- SMS ricevuto (per mittente)
- Avvio manuale

**Condizioni** (filtri aggiuntivi valutati al momento del trigger):
batteria sopra/sotto soglia, Wi-Fi connesso, fascia orario, giorno della settimana.

**Azioni**: messaggio toast, notifica, apri app, apri URL, modalità suoneria,
volume media, attiva/disattiva Wi-Fi, attiva/disattiva Bluetooth, vibrazione,
sintesi vocale (TTS), invio SMS, attesa (delay), blocco schermo, pannello modalità aereo.

Il modello è progettato per essere estensibile: nuovi trigger/condizioni/azioni si
aggiungono come nuove varianti delle sealed class in `data/model/`, un branch nel
matching (`engine/AutomationEngine.kt` o `engine/ActionExecutor.kt`) e una voce nel
catalogo UI (`ui/Catalogs.kt`).

## Architettura

- `data/model` — modello di dominio (`Automation`, `Trigger`, `Condition`, `Action`),
  serializzato in JSON polimorfico con kotlinx.serialization.
- `data/db` — Room (`AutomationEntity`, `AutomationDao`, `AppDatabase`) con i
  `TypeConverter` per salvare trigger/condizioni/azioni come JSON.
- `engine` — `AutomationEngine` (matching trigger/condizioni), `ConditionEvaluator`,
  `ActionExecutor` (esecuzione effettiva), `AlarmScheduler` (alarm settimanali per i
  trigger a orario fisso), `DeviceStateProvider`.
- `service` — `AutomationForegroundService` (foreground service sempre attivo che
  registra i `BroadcastReceiver` dinamici per batteria/carica/schermo e il
  `NetworkCallback` per il Wi-Fi — necessari perché questi intent non sono più
  consegnabili via manifest dalla versione 8 di Android in su), `AppAccessibilityService`
  (rileva l'app in primo piano e blocca lo schermo), `AppNotificationListenerService`
  (intercetta le notifiche).
- `receiver` — `BootReceiver`, `AlarmReceiver` (trigger a orario fisso, si
  riprogramma da solo ogni settimana), `SmsReceiver`.
- `ui` — schermate Compose: lista automazioni, editor (selezione trigger/condizioni/
  azioni con form dedicati per tipo), schermata permessi.

## Build

Richiede Android SDK (compileSdk 34, minSdk 26) e JDK 17+.

```bash
export ANDROID_HOME=/percorso/android-sdk
./gradlew :app:assembleDebug      # APK di debug
./gradlew :app:assembleRelease    # APK di release (minificato con R8)
```

L'APK di debug generato si trova in `app/build/outputs/apk/debug/app-debug.apk`.
Sia la build debug che quella release (con R8/Proguard) sono state verificate in
questo ambiente e completano con successo.

In alternativa, apri la cartella in Android Studio (Iguana o successivo) e usa
Run/Build dall'IDE.

## Permessi da concedere dopo l'installazione

Molti permessi non possono essere richiesti via popup e vanno attivati manualmente
dalle impostazioni di sistema. L'app include una schermata **Permessi** (icona
scudo nella toolbar) che mostra lo stato e apre la schermata giusta per ciascuno:

- **Servizio di Accessibilità** — necessario per il trigger "App avviata" e
  l'azione "Blocca schermo".
- **Accesso alle notifiche** — necessario per il trigger "Notifica ricevuta".
- **Ignora ottimizzazione batteria** — evita che il sistema uccida il servizio in
  background.
- **Accesso Non disturbare** — necessario per l'azione "Modalità suoneria"
  (silenzioso/vibrazione) sulle versioni moderne di Android.
- **Notifiche, SMS** — permessi runtime standard richiesti con il normale popup.

## Limiti noti della piattaforma

- Da Android 10 in su, attivare/disattivare Wi-Fi e Bluetooth via codice non è più
  permesso alle app normali: l'azione corrispondente apre il pannello rapido di
  sistema invece di attivarlo direttamente.
- L'invio SMS richiede il permesso `SEND_SMS`; su Android moderno funziona solo se
  l'utente lo concede esplicitamente (non è richiedibile per le app che non sono
  l'app SMS predefinita su alcuni OEM).
- Gli allarmi esatti (trigger a orario fisso) usano `SCHEDULE_EXACT_ALARM`; su
  Android 12+ alcuni dispositivi richiedono che l'utente lo confermi dalle
  impostazioni di sistema se il permesso viene revocato.
- Il rilevamento dell'SSID Wi-Fi al cambio di rete richiede permessi di
  localizzazione su Android 8+; in questa versione il trigger Wi-Fi funziona per
  "connesso/disconnesso" generico, il filtro SSID è opzionale e non sempre risolto.
