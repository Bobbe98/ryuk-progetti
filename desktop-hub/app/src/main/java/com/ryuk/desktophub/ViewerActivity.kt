package com.ryuk.desktophub

import android.content.ClipData
import android.content.ClipboardManager
import android.os.Bundle
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Mouse
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material.icons.filled.ZoomOutMap
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.ryuk.desktophub.data.InputMode
import com.ryuk.desktophub.data.Settings
import com.ryuk.desktophub.termux.Scripts
import com.ryuk.desktophub.ui.DesktopHubTheme
import com.ryuk.desktophub.vnc.KeySyms
import com.ryuk.desktophub.vnc.RemoteDesktopView
import com.ryuk.desktophub.vnc.RfbClient
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/** Visualizzatore a schermo intero del desktop (client VNC su 127.0.0.1). */
class ViewerActivity : ComponentActivity() {

    private enum class Status { CONNECTING, CONNECTED, DISCONNECTED }

    private lateinit var desktopView: RemoteDesktopView
    private var client: RfbClient? = null
    private var attempts = 0
    private var everConnected = false
    private var destroyed = false

    private var status by mutableStateOf(Status.CONNECTING)
    private var errorText by mutableStateOf<String?>(null)
    private var toolbarVisible by mutableStateOf(true)
    private var inputMode by mutableStateOf(InputMode.TOUCH)
    private var sticky by mutableStateOf(setOf<Int>())
    private var showLoadingHint by mutableStateOf(false)
    private var suggestOpenTermux by mutableStateOf(false)

    private val password by lazy { intent.getStringExtra(EXTRA_PASSWORD).orEmpty() }

    private val filePicker = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.OpenMultipleDocuments()
    ) { uris -> if (uris.isNotEmpty()) openPhoneFiles(uris) }

    private fun openPhoneFiles(uris: List<android.net.Uri>) {
        android.widget.Toast.makeText(this, "Preparazione del file…", android.widget.Toast.LENGTH_SHORT).show()
        lifecycleScope.launch {
            val result = PhoneFileOpener(this@ViewerActivity).open(uris)
            android.widget.Toast.makeText(
                this@ViewerActivity, PhoneFileOpener.describe(result), android.widget.Toast.LENGTH_LONG
            ).show()
            if (result == PhoneFileOpener.Result.NeedsStorage) {
                runCatching {
                    com.ryuk.desktophub.termux.TermuxBridge(this@ViewerActivity)
                        .runInTerminal(Scripts.storageSetup, "Desktop Hub: accesso ai file")
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        inputMode = intent.getStringExtra(EXTRA_INPUT_MODE)
            ?.let { n -> InputMode.entries.firstOrNull { it.name == n } } ?: InputMode.TOUCH

        desktopView = RemoteDesktopView(this).apply {
            inputMode = this@ViewerActivity.inputMode
            onStickyModifiersConsumed = { runOnUiThread { sticky = emptySet() } }
        }

        setContent {
            DesktopHubTheme(darkTheme = true) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                        .imePadding()
                ) {
                    Column(Modifier.fillMaxSize()) {
                        AndroidView(factory = { desktopView }, modifier = Modifier.weight(1f).fillMaxWidth())
                        AnimatedVisibility(visible = toolbarVisible && status == Status.CONNECTED) {
                            KeysBar()
                        }
                    }

                    // pulsante per mostrare/nascondere la barra
                    IconButton(
                        onClick = { toolbarVisible = !toolbarVisible },
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .size(36.dp)
                            .background(Color(0x66000000), CircleShape),
                    ) {
                        Icon(
                            if (toolbarVisible) Icons.Default.Close else Icons.Default.MoreVert,
                            contentDescription = "Barra strumenti",
                            tint = Color.White,
                        )
                    }

                    when (status) {
                        Status.CONNECTING -> Overlay {
                            CircularProgressIndicator()
                            Text("Connessione al desktop…", color = Color.White)
                        }
                        Status.DISCONNECTED -> Overlay {
                            Text(
                                if (everConnected) "Il desktop si è disconnesso." else "Impossibile collegarsi al desktop.",
                                color = Color.White,
                                style = MaterialTheme.typography.titleMedium,
                            )
                            errorText?.let {
                                Text(it, color = Color.LightGray, style = MaterialTheme.typography.bodyMedium)
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (suggestOpenTermux) {
                                    Button(onClick = { openTermux() }) { Text("Apri Termux") }
                                    OutlinedButton(onClick = { attempts = 0; connect() }) { Text("Riconnetti") }
                                } else {
                                    Button(onClick = { attempts = 0; connect() }) { Text("Riconnetti") }
                                }
                                OutlinedButton(onClick = { finish() }) { Text("Esci") }
                            }
                        }
                        Status.CONNECTED -> if (showLoadingHint) {
                            Column(
                                Modifier.align(Alignment.Center).padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                CircularProgressIndicator()
                                Text(
                                    "Caricamento del desktop…\nLa prima volta può richiedere fino a un minuto.",
                                    color = Color.White,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                )
                            }
                        }
                    }
                }
            }
        }
        connect()
    }

    @Composable
    private fun Overlay(content: @Composable () -> Unit) {
        Box(Modifier.fillMaxSize().background(Color(0xCC000000)), contentAlignment = Alignment.Center) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(24.dp),
            ) { content() }
        }
    }

    @Composable
    private fun KeysBar() {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color(0xFF202020))
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 4.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            BarIcon(Icons.Default.Keyboard, "Tastiera") { toggleKeyboard() }
            BarKey("Esc") { desktopView.typeKeysym(KeySyms.ESCAPE) }
            BarKey("Tab") { desktopView.typeKeysym(KeySyms.TAB) }
            StickyKey("Ctrl", KeySyms.CONTROL_L)
            StickyKey("Alt", KeySyms.ALT_L)
            StickyKey("Win", KeySyms.SUPER_L)
            BarKey("←") { desktopView.typeKeysym(KeySyms.LEFT) }
            BarKey("↑") { desktopView.typeKeysym(KeySyms.UP) }
            BarKey("↓") { desktopView.typeKeysym(KeySyms.DOWN) }
            BarKey("→") { desktopView.typeKeysym(KeySyms.RIGHT) }
            BarKey("Canc") { desktopView.typeKeysym(KeySyms.DELETE) }
            BarKey("F11") { desktopView.typeKeysym(KeySyms.F1 + 10) }
            BarIcon(Icons.Default.FolderOpen, "Apri file dal telefono") {
                if (PhoneFileOpener(this@ViewerActivity).needsLegacyWritePermission()) {
                    android.widget.Toast.makeText(
                        this@ViewerActivity, "Usa \"Apri file dal telefono\" nella schermata principale",
                        android.widget.Toast.LENGTH_LONG,
                    ).show()
                } else {
                    runCatching { filePicker.launch(arrayOf("*/*")) }
                }
            }
            BarIcon(Icons.Default.ContentPaste, "Incolla dal telefono") { pasteFromPhone() }
            BarIcon(
                if (inputMode == InputMode.TOUCH) Icons.Default.TouchApp else Icons.Default.Mouse,
                if (inputMode == InputMode.TOUCH) "Modalità: tocco" else "Modalità: touchpad",
            ) { switchInputMode() }
            BarIcon(Icons.Default.ZoomOutMap, "Adatta allo schermo") { desktopView.resetZoom() }
            BarIcon(Icons.AutoMirrored.Filled.ExitToApp, "Esci") { finish() }
        }
    }

    @Composable
    private fun BarKey(label: String, onClick: () -> Unit) {
        FilterChip(selected = false, onClick = onClick, label = { Text(label, color = Color.White) })
    }

    @Composable
    private fun StickyKey(label: String, keysym: Int) {
        FilterChip(
            selected = keysym in sticky,
            onClick = {
                if (keysym in desktopView.stickyModifiers) desktopView.stickyModifiers.remove(keysym)
                else desktopView.stickyModifiers.add(keysym)
                sticky = desktopView.stickyModifiers.toSet()
            },
            label = { Text(label, color = Color.White) },
        )
    }

    @Composable
    private fun BarIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, description: String, onClick: () -> Unit) {
        IconButton(onClick = onClick) { Icon(icon, contentDescription = description, tint = Color.White) }
    }

    // --- Connessione ---------------------------------------------------------------------

    private fun connect() {
        client?.disconnect()
        status = Status.CONNECTING
        errorText = null
        attempts++
        val c = RfbClient("127.0.0.1", Scripts.VNC_PORT, password, object : RfbClient.Listener {
            override fun onConnected(width: Int, height: Int, name: String) {
                desktopView.onFrameResized(width, height)
                runOnUiThread {
                    everConnected = true
                    attempts = 0
                    status = Status.CONNECTED
                    watchForContent(c = client, startedAt = System.currentTimeMillis())
                }
            }

            override fun onResize(width: Int, height: Int) = desktopView.onFrameResized(width, height)

            override fun onUpdate(x: Int, y: Int, w: Int, h: Int) = desktopView.onFrameUpdate(x, y, w, h)

            override fun onClipboard(text: String) {
                runOnUiThread {
                    getSystemService(ClipboardManager::class.java)
                        ?.setPrimaryClip(ClipData.newPlainText("Desktop", text))
                }
            }

            override fun onDisconnected(error: Throwable?) {
                runOnUiThread {
                    if (destroyed) return@runOnUiThread
                    showLoadingHint = false
                    val notResponding = error is RfbClient.NotRespondingException
                    val authFailed = error is RfbClient.AuthException
                    // il server può impiegare qualche secondo ad avviarsi: riprova in silenzio
                    val maxAttempts = if (notResponding) 2 else MAX_ATTEMPTS
                    if (!everConnected && attempts < maxAttempts && !authFailed) {
                        desktopView.postDelayed({ if (!destroyed) connect() }, RETRY_DELAY_MS)
                        return@runOnUiThread
                    }
                    status = Status.DISCONNECTED
                    suggestOpenTermux = notResponding || error is java.net.ConnectException
                    errorText = when {
                        notResponding ->
                            "Android ha messo in pausa Termux, e con lui il desktop. Apri Termux un " +
                                "momento, torna qui e premi Riconnetti. Per evitarlo: nelle impostazioni " +
                                "di Android togli Termux dall'ottimizzazione della batteria."
                        authFailed ->
                            "Password del desktop non valida. Torna indietro e premi di nuovo Avvia desktop."
                        error is java.net.ConnectException ->
                            "Il desktop non è in esecuzione (forse Android lo ha chiuso). Torna indietro e " +
                                "premi Avvia desktop."
                        else -> error?.message
                    }
                }
            }
        })
        client = c
        desktopView.client = c
        c.connect()
    }

    /** Mostra "Caricamento…" finché lo schermo è tutto nero (al massimo 90 secondi). */
    private fun watchForContent(c: RfbClient?, startedAt: Long) {
        if (destroyed || c == null || c !== client || status != Status.CONNECTED) return
        val hasContent = c.hasVisibleContent()
        val elapsed = System.currentTimeMillis() - startedAt
        // breve attesa iniziale: evita il lampeggio se il desktop è già pronto
        showLoadingHint = !hasContent && elapsed in 1500..90_000
        if (!hasContent && elapsed < 90_000) {
            desktopView.postDelayed({ watchForContent(c, startedAt) }, 500)
        }
    }

    private fun openTermux() {
        packageManager.getLaunchIntentForPackage(com.ryuk.desktophub.termux.TermuxBridge.PACKAGE)
            ?.let { startActivity(it) }
    }

    private fun toggleKeyboard() {
        val imm = getSystemService(InputMethodManager::class.java) ?: return
        val visible = ViewCompat.getRootWindowInsets(desktopView)?.isVisible(WindowInsetsCompat.Type.ime()) == true
        if (visible) {
            imm.hideSoftInputFromWindow(desktopView.windowToken, 0)
        } else {
            desktopView.requestFocus()
            imm.showSoftInput(desktopView, InputMethodManager.SHOW_IMPLICIT)
        }
    }

    private fun pasteFromPhone() {
        val text = getSystemService(ClipboardManager::class.java)
            ?.primaryClip?.takeIf { it.itemCount > 0 }
            ?.getItemAt(0)?.coerceToText(this)?.toString()
        if (text.isNullOrEmpty()) return
        val c = client ?: return
        c.sendClipboard(text)
        // Ctrl+V nell'app in primo piano
        c.sendKey(KeySyms.CONTROL_L, true)
        c.tapKey('v'.code)
        c.sendKey(KeySyms.CONTROL_L, false)
    }

    private fun switchInputMode() {
        inputMode = if (inputMode == InputMode.TOUCH) InputMode.TOUCHPAD else InputMode.TOUCH
        desktopView.inputMode = inputMode
        Settings(this).inputMode = inputMode
    }

    override fun onResume() {
        super.onResume()
        // di ritorno da Termux (che così si "risveglia"): riprova da solo
        if (status == Status.DISCONNECTED && suggestOpenTermux) {
            attempts = 0
            connect()
        }
    }

    override fun onDestroy() {
        destroyed = true
        client?.disconnect()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_PASSWORD = "password"
        const val EXTRA_INPUT_MODE = "input_mode"
        private const val MAX_ATTEMPTS = 15
        private const val RETRY_DELAY_MS = 800L
    }
}
