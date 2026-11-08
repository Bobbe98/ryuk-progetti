package com.ryuk.desktophub

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings as AndroidSettings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.app.ActivityCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ryuk.desktophub.termux.TermuxBridge
import com.ryuk.desktophub.ui.AddCustomAppDialog
import com.ryuk.desktophub.ui.AppsScreen
import com.ryuk.desktophub.ui.DesktopHubTheme
import com.ryuk.desktophub.ui.SettingsScreen
import com.ryuk.desktophub.ui.SetupScreen

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    private val permissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (!granted && !ActivityCompat.shouldShowRequestPermissionRationale(this, TermuxBridge.PERMISSION)) {
            // rifiutato in modo permanente: si concede dalle impostazioni dell'app
            Toast.makeText(this, "Attiva \"Esegui comandi in Termux\" nei permessi dell'app", Toast.LENGTH_LONG).show()
            startActivity(
                Intent(AndroidSettings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
            )
        }
        viewModel.refresh()
    }

    private val filePicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) viewModel.openPhoneFile(uri)
    }

    private val legacyWritePermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) filePicker.launch(arrayOf("*/*"))
    }

    private fun pickPhoneFile() {
        if (PhoneFileOpener(this).needsLegacyWritePermission()) {
            legacyWritePermission.launch(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
        } else {
            runCatching { filePicker.launch(arrayOf("*/*")) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            DesktopHubTheme {
                val state by viewModel.state.collectAsStateWithLifecycle()
                val snackbar = remember { SnackbarHostState() }
                var tab by rememberSaveable { mutableIntStateOf(0) }
                var showAddDialog by remember { mutableStateOf(false) }

                LaunchedEffect(Unit) {
                    viewModel.events.collect { event ->
                        when (event) {
                            is UiEvent.Message -> snackbar.showSnackbar(event.text)
                            UiEvent.OpenViewer -> openViewer()
                        }
                    }
                }

                Scaffold(
                    topBar = {
                        TopAppBar(
                            title = { Text("Desktop Hub") },
                            actions = {
                                if (state.checking) {
                                    CircularProgressIndicator(Modifier.padding(12.dp))
                                } else {
                                    IconButton(onClick = viewModel::refresh) {
                                        Icon(Icons.Default.Refresh, contentDescription = "Aggiorna")
                                    }
                                }
                            },
                        )
                    },
                    bottomBar = {
                        NavigationBar {
                            NavigationBarItem(
                                selected = tab == 0, onClick = { tab = 0 },
                                icon = { Icon(Icons.Default.RocketLaunch, null) }, label = { Text("Inizia") },
                            )
                            NavigationBarItem(
                                selected = tab == 1, onClick = { tab = 1 },
                                icon = { Icon(Icons.Default.Apps, null) }, label = { Text("App") },
                            )
                            NavigationBarItem(
                                selected = tab == 2, onClick = { tab = 2 },
                                icon = { Icon(Icons.Default.Settings, null) }, label = { Text("Impostazioni") },
                            )
                        }
                    },
                    floatingActionButton = {
                        if (tab == 1) {
                            ExtendedFloatingActionButton(
                                onClick = { showAddDialog = true },
                                icon = { Icon(Icons.Default.Add, null) },
                                text = { Text("Aggiungi") },
                            )
                        }
                    },
                    snackbarHost = { SnackbarHost(snackbar) },
                ) { padding ->
                    val modifier = Modifier.padding(padding)
                    when (tab) {
                        0 -> SetupScreen(
                            state = state,
                            onLaunchDesktop = { viewModel.launch() },
                            onStopDesktop = viewModel::stopDesktop,
                            onOpenPhoneFile = ::pickPhoneFile,
                            onOpenUrl = ::openUrl,
                            onCopy = ::copyToClipboard,
                            onOpenTermux = viewModel::openTermux,
                            onRequestPermission = { permissionLauncher.launch(TermuxBridge.PERMISSION) },
                            onRunSetup = viewModel::runSetup,
                            onSetupStorage = viewModel::setupStorage,
                            onGoToSettings = { tab = 2 },
                            modifier = modifier,
                        )
                        1 -> AppsScreen(
                            state = state,
                            onInstall = viewModel::install,
                            onUninstall = viewModel::uninstall,
                            onLaunch = { viewModel.launch(it) },
                            onRemoveCustom = viewModel::removeCustomApp,
                            modifier = modifier,
                        )
                        else -> SettingsScreen(
                            state = state,
                            vncPassword = viewModel.settings.vncPassword,
                            desktopSize = viewModel.settings.desktopSize(),
                            onEnvironment = viewModel::setEnvironment,
                            onResolution = viewModel::setResolution,
                            onInputMode = viewModel::setInputMode,
                            onStopDesktop = viewModel::stopDesktop,
                            onInstallEnvironment = viewModel::runSetup,
                            modifier = modifier,
                        )
                    }
                }

                if (showAddDialog) {
                    AddCustomAppDialog(
                        onDismiss = { showAddDialog = false },
                        onAdd = { name, pkgs, launch ->
                            viewModel.addCustomApp(name, pkgs, launch)
                            showAddDialog = false
                        },
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // al ritorno da Termux (installazioni, configurazione) aggiorna lo stato
        viewModel.refresh()
    }

    private fun openViewer() {
        startActivity(
            Intent(this, ViewerActivity::class.java)
                .putExtra(ViewerActivity.EXTRA_PASSWORD, viewModel.settings.vncPassword)
                .putExtra(ViewerActivity.EXTRA_INPUT_MODE, viewModel.settings.inputMode.name)
        )
    }

    private fun openUrl(url: String) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
    }

    private fun copyToClipboard(text: String) {
        val cm = getSystemService(ClipboardManager::class.java)
        cm.setPrimaryClip(ClipData.newPlainText("Comando Termux", text))
        Toast.makeText(this, "Comando copiato", Toast.LENGTH_SHORT).show()
    }
}
