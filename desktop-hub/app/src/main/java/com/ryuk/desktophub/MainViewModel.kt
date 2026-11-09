package com.ryuk.desktophub

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ryuk.desktophub.data.AppCatalog
import com.ryuk.desktophub.data.DesktopApp
import com.ryuk.desktophub.data.DesktopEnvironment
import com.ryuk.desktophub.data.InputMode
import com.ryuk.desktophub.data.Resolution
import com.ryuk.desktophub.data.Settings
import com.ryuk.desktophub.termux.Scripts
import com.ryuk.desktophub.termux.TermuxBridge
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import android.net.Uri

data class UiState(
    val termuxInstalled: Boolean = false,
    val permissionGranted: Boolean = false,
    /** null = mai verificato; true = Termux risponde ai comandi; false = non risponde/errore. */
    val termuxReachable: Boolean? = null,
    val checking: Boolean = false,
    val xvncInstalled: Boolean = false,
    val environmentsInstalled: Set<DesktopEnvironment> = emptySet(),
    val desktopRunning: Boolean = false,
    /** Termux vede la memoria del telefono (~/storage/shared). */
    val storageReady: Boolean = false,
    val installed: Set<String> = emptySet(),
    val busyMessage: String? = null,
    val environment: DesktopEnvironment = DesktopEnvironment.XFCE,
    val resolution: Resolution = Resolution.MEDIUM,
    val inputMode: InputMode = InputMode.TOUCH,
    val apps: List<DesktopApp> = emptyList(),
) {
    val desktopReady get() = xvncInstalled && environment in environmentsInstalled
}

sealed interface UiEvent {
    data class Message(val text: String) : UiEvent
    data object OpenViewer : UiEvent
    /** Avviso breve che deve restare visibile anche mentre si apre il desktop (Toast). */
    data class Notice(val text: String) : UiEvent
}

class MainViewModel(app: Application) : AndroidViewModel(app) {

    val settings = Settings(app)
    private val bridge = TermuxBridge(app)

    private val _state = MutableStateFlow(
        UiState(
            installed = settings.installedCache,
            environment = settings.environment,
            resolution = settings.resolution,
            inputMode = settings.inputMode,
            apps = allApps(),
        )
    )
    val state: StateFlow<UiState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<UiEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<UiEvent> = _events

    private fun allApps() = AppCatalog.builtIn + settings.customApps

    private fun message(text: String) {
        _events.tryEmit(UiEvent.Message(text))
    }

    /** Ricontrolla Termux, permesso e (se possibile) le app installate. */
    fun refresh() {
        val installed = bridge.isTermuxInstalled()
        val granted = installed && bridge.hasRunCommandPermission()
        _state.update { it.copy(termuxInstalled = installed, permissionGranted = granted) }
        if (!installed || !granted || _state.value.checking) return

        viewModelScope.launch {
            _state.update { it.copy(checking = true) }
            val apps = allApps()
            val result = runCatching { bridge.runBackground(Scripts.status(apps), timeoutMs = 20_000) }
            _state.update { it.copy(checking = false) }

            val r = result.getOrElse {
                _state.update { s -> s.copy(termuxReachable = false) }
                message("Impossibile contattare Termux: ${it.message}")
                return@launch
            }
            if (r == null) {
                _state.update { it.copy(termuxReachable = false) }
                return@launch
            }
            if (!r.ok || !r.stdout.contains("DONE")) {
                _state.update { it.copy(termuxReachable = false) }
                message(explainTermuxError(r))
                return@launch
            }
            val lines = r.stdout.lines().map { it.trim() }
            val installedIds = lines.filter { it.startsWith("APP:") }.map { it.removePrefix("APP:") }.toSet()
            val envs = lines.filter { it.startsWith("ENV:") }
                .mapNotNull { l -> DesktopEnvironment.entries.firstOrNull { it.name == l.removePrefix("ENV:") } }
                .toSet()
            settings.installedCache = installedIds
            _state.update {
                it.copy(
                    termuxReachable = true,
                    xvncInstalled = "XVNC_OK" in lines,
                    desktopRunning = "DESKTOP_RUNNING" in lines,
                    storageReady = "STORAGE_OK" in lines,
                    environmentsInstalled = envs,
                    installed = installedIds,
                    apps = apps,
                )
            }
        }
    }

    /** Messaggio per un programma che si è chiuso subito dopo l'avvio. */
    private fun explainAppFailure(app: DesktopApp, r: TermuxBridge.CommandResult): String {
        val code = Regex("APP_FAILED:(\\d+)").find(r.stdout)?.groupValues?.get(1)?.toIntOrNull()
        val log = r.stderr.trim().lines().filter { it.isNotBlank() }.takeLast(4).joinToString("\n")
        return when (code) {
            137 -> "${app.name} è stato chiuso da Android (troppi processi in background). " +
                "Attiva in Opzioni sviluppatore \"Disattiva restrizioni processi secondari\" " +
                "e riprova (vedi Consigli nella scheda Inizia)."
            127 -> "${app.name}: comando non trovato. Prova a reinstallarlo dalla scheda App."
            else -> "${app.name} si è chiuso subito (codice $code)." +
                if (log.isNotEmpty()) "\n$log" else ""
        }
    }

    private fun explainTermuxError(r: TermuxBridge.CommandResult): String {
        val msg = r.describeError()
        return if (msg.contains("allow-external-apps", ignoreCase = true)) {
            "Termux non accetta ancora comandi da altre app: esegui il passaggio 2 (abilita il collegamento)."
        } else {
            "Errore da Termux: $msg"
        }
    }

    private fun runInTerminal(script: String, label: String) {
        try {
            bridge.runInTerminal(script, label)
        } catch (e: SecurityException) {
            message("Permesso negato: concedi il permesso di Termux (passaggio 3).")
        } catch (e: Exception) {
            message("Impossibile avviare Termux: ${e.message}")
        }
    }

    fun openTermux() {
        if (!bridge.launchTermux()) message("Termux non è installato.")
    }

    fun runSetup() = runInTerminal(Scripts.setup(settings.environment), "Desktop Hub: configurazione")

    fun setupStorage() = runInTerminal(Scripts.storageSetup, "Desktop Hub: accesso ai file")

    fun install(app: DesktopApp) = runInTerminal(Scripts.installApp(app), "Installa ${app.name}")

    fun uninstall(app: DesktopApp) = runInTerminal(Scripts.uninstallApp(app), "Rimuovi ${app.name}")

    /** Avvia il desktop (e opzionalmente un'app), poi apre il visualizzatore. */
    fun launch(app: DesktopApp? = null) {
        val s = _state.value
        if (s.busyMessage != null) return
        if (!s.termuxInstalled || !s.permissionGranted) {
            message("Completa prima la configurazione nella scheda Inizia.")
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(busyMessage = if (app != null) "Avvio di ${app.name}…" else "Avvio del desktop…") }
            val (w, h) = settings.desktopSize()
            val script = buildString {
                appendLine(Scripts.startDesktop(settings.environment, w, h, settings.vncPassword))
                if (app != null) appendLine(Scripts.launchApp(app))
            }
            val r = runCatching { bridge.runBackground(script, timeoutMs = 30_000) }.getOrNull()
            _state.update { it.copy(busyMessage = null) }
            when {
                r == null -> message("Termux non ha risposto. Apri Termux una volta e riprova.")
                app != null && r.exitCode == Scripts.EXIT_APP_FAILED -> {
                    _state.update { it.copy(desktopRunning = true) }
                    message(explainAppFailure(app, r))
                }
                !r.ok || !r.stdout.contains("STARTED") -> message(explainTermuxError(r))
                else -> {
                    _state.update { it.copy(desktopRunning = true) }
                    if ("FIRST_WINE_RUN" in r.stdout) {
                        _events.tryEmit(
                            UiEvent.Notice(
                                "Prima apertura di Wine: la preparazione può richiedere 1-3 minuti. " +
                                    "Attendi nel desktop senza chiudere."
                            )
                        )
                    }
                    _events.tryEmit(UiEvent.OpenViewer)
                }
            }
        }
    }

    /** Apre nel desktop un file scelto dal telefono (copiato dove Termux lo vede). */
    fun openPhoneFile(uri: Uri) {
        val s = _state.value
        if (s.busyMessage != null) return
        if (!s.desktopReady) {
            message("Completa prima la configurazione nella scheda Inizia.")
            return
        }
        if (s.termuxReachable == true && !s.storageReady) {
            message("Prima consenti a Termux di vedere i file del telefono, poi riprova.")
            setupStorage()
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(busyMessage = "Preparazione del file…") }
            val result = PhoneFileOpener(getApplication()).open(uri)
            _state.update { it.copy(busyMessage = null) }
            when (result) {
                is PhoneFileOpener.Result.Opened -> {
                    _state.update { it.copy(desktopRunning = true) }
                    _events.tryEmit(UiEvent.OpenViewer)
                }
                PhoneFileOpener.Result.NeedsStorage -> {
                    message(PhoneFileOpener.describe(result))
                    setupStorage()
                }
                else -> message(PhoneFileOpener.describe(result))
            }
        }
    }

    fun stopDesktop() {
        viewModelScope.launch {
            _state.update { it.copy(busyMessage = "Chiusura del desktop…") }
            val r = runCatching { bridge.runBackground(Scripts.stopDesktop(), timeoutMs = 15_000) }.getOrNull()
            _state.update { it.copy(busyMessage = null, desktopRunning = r?.ok != true && it.desktopRunning) }
            message(if (r?.ok == true) "Desktop chiuso." else "Impossibile chiudere il desktop.")
        }
    }

    fun setEnvironment(env: DesktopEnvironment) {
        settings.environment = env
        _state.update { it.copy(environment = env) }
    }

    fun setResolution(res: Resolution) {
        settings.resolution = res
        _state.update { it.copy(resolution = res) }
        if (_state.value.desktopRunning) message("La nuova risoluzione vale dal prossimo avvio del desktop.")
    }

    fun setInputMode(mode: InputMode) {
        settings.inputMode = mode
        _state.update { it.copy(inputMode = mode) }
    }

    fun addCustomApp(name: String, packages: String, launch: String) {
        settings.addCustomApp(name.trim(), packages.trim(), launch.trim())
        _state.update { it.copy(apps = allApps()) }
    }

    fun removeCustomApp(app: DesktopApp) {
        settings.removeCustomApp(app.id)
        _state.update { it.copy(apps = allApps()) }
    }
}
