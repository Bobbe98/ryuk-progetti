---
name: verifica
description: Verifica completa di Ryuk Automation prima di un commit o di una PR — build debug, test unitari, lint Android, build release con R8, controllo permessi/segreti e revisione del diff — con un report PASS/FAIL. Usala dopo ogni feature, refactor o correzione, e sempre prima di pushare.
---

# Verifica — Ryuk Automation

Esegui le fasi in ordine. Se una fase fallisce, fermati, correggi e riparti da quella fase.
Richiede JDK 17+ e `ANDROID_HOME` impostato (vedi README). Se l'SDK Android non c'è nell'ambiente, dillo chiaramente nel report invece di saltare la fase in silenzio.

## 1. Build debug
```bash
./gradlew :app:assembleDebug
```

## 2. Test unitari
```bash
./gradlew :app:testDebugUnitTest
```
Se hai toccato `engine/` (matching trigger/condizioni, `ConditionEvaluator`) o la serializzazione in `data/model/`, aggiungi o aggiorna un test JUnit in `app/src/test/`.

## 3. Lint Android
```bash
./gradlew :app:lintDebug
```
Nessun nuovo errore. Report in `app/build/reports/lint-results-debug.html`.

## 4. Build release (R8)
Solo se hai toccato modelli serializzati, `proguard-rules.pro` o dipendenze:
```bash
./gradlew :app:assembleRelease
```
Le classi `@Serializable` devono sopravvivere alla minificazione.

## 5. Permessi, componenti esportati e segreti
```bash
git diff HEAD -- app/src/main/AndroidManifest.xml
git diff HEAD -U0 | grep -nE "^\+.*(api[_-]?key|secret|token|password)" || true
git diff HEAD -U0 | grep -nE "^\+.*Log\.(d|v|i)\(" || true
```
- Ogni nuovo permesso è davvero necessario ed è mostrato nella schermata Permessi.
- Ogni nuovo `exported="true"` ha un motivo e, dove serve, un permesso di protezione.
- Niente contenuto di SMS o notifiche nei log.

## 6. Revisione del diff
```bash
git status --short
git diff --stat
```
Per ogni file cambiato: niente modifiche non volute, `CancellationException` mai inghiottita, I/O fuori dal main thread, nuovi trigger/azioni aggiunti in tutti e tre i punti (sealed class in `data/model/`, branch in `engine/`, voce in `ui/Catalogs.kt`).
Per modifiche grandi, fai rivedere il diff all'agente `kotlin-reviewer`.

## Report
```
VERIFICA
========
Build debug:  PASS/FAIL
Test:         PASS/FAIL (X/Y)
Lint:         PASS/FAIL (N errori)
Release R8:   PASS/FAIL/NON NECESSARIA
Sicurezza:    PASS/FAIL
Diff:         N file

Esito: PRONTO / NON PRONTO
Da sistemare:
1. ...
```
