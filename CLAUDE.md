# Ryuk Automation — istruzioni per Claude

App Android in **Kotlin + Jetpack Compose** per automazioni **trigger → condizioni → azioni** (stile Tasker/MacroDroid). Interfaccia **in italiano**.

## Stack
- Modulo unico `:app`, compileSdk/targetSdk 34, minSdk 26, JDK 17
- Compose (BOM 2024.06), Navigation Compose, Material 3
- Room (con KAPT) + kotlinx.serialization (trigger/condizioni/azioni salvati come JSON polimorfico)
- Coroutines; release minificata con R8

## Struttura
`data/model` dominio (sealed class `Trigger`, `Condition`, `Action`) · `data/db` Room · `data/repository` · `engine` matching ed esecuzione · `service` foreground, accessibilità, listener notifiche · `receiver` boot, alarm, SMS · `ui` schermate Compose · `viewmodel`.

## Regole di lavoro
1. **Nuovo trigger/condizione/azione = tre punti**: variante `@Serializable` della sealed class in `data/model/`, branch in `engine/AutomationEngine.kt` o `engine/ActionExecutor.kt`, voce in `ui/Catalogs.kt`. Il `when` sulle sealed class deve restare esaustivo (niente `else`).
2. **Coroutine strutturate**: niente `GlobalScope`; I/O e database su `Dispatchers.IO`; non inghiottire mai `CancellationException`.
3. **Compose**: niente lavoro su DB/rete dentro i Composable (usa ViewModel o `LaunchedEffect`), `key` stabili nelle `LazyColumn`.
4. **Permessi e sicurezza**: l'app gestisce SMS, notifiche e accessibilità. Ogni nuovo permesso va motivato e mostrato nella schermata Permessi; non loggare mai contenuti di SMS o notifiche; ogni componente `exported` va giustificato.
5. **Kotlin idiomatico**: `val` invece di `var`, niente `!!`, liste immutabili nelle API pubbliche.
6. **Test**: la logica di `engine/` (matching, `ConditionEvaluator`) e la serializzazione dei modelli vanno coperte da test JUnit in `app/src/test/`.
7. **Prima di ogni commit** usa la skill `verifica`.

## Strumenti in `.claude/`
- skill `verifica` — build, test, lint e controlli di sicurezza di questo progetto
- agente `kotlin-reviewer` — revisione del diff, riporta problemi per gravità

L'agente viene da [ECC](https://github.com/affaan-m/ECC) (licenza MIT, vedi `.claude/ECC-LICENSE`), adattato a questo progetto.
