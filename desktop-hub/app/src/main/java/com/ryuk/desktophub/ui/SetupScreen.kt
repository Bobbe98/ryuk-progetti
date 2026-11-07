package com.ryuk.desktophub.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DesktopWindows
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ryuk.desktophub.UiState
import com.ryuk.desktophub.termux.Scripts

@Composable
fun SetupScreen(
    state: UiState,
    onLaunchDesktop: () -> Unit,
    onStopDesktop: () -> Unit,
    onOpenUrl: (String) -> Unit,
    onCopy: (String) -> Unit,
    onOpenTermux: () -> Unit,
    onRequestPermission: () -> Unit,
    onRunSetup: () -> Unit,
    onSetupStorage: () -> Unit,
    onGoToSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        DesktopCard(state, onLaunchDesktop, onStopDesktop)

        Text("Configurazione", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))

        StepCard(
            number = 1,
            title = "Installa Termux",
            done = state.termuxInstalled,
            text = "Termux è il motore Linux gratuito e open source che fa girare le app per computer " +
                "sul telefono, senza root. Scaricalo da F-Droid o GitHub (la versione del Play Store " +
                "può essere limitata).",
        ) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(onClick = { onOpenUrl(com.ryuk.desktophub.termux.TermuxBridge.FDROID_URL) }) { Text("F-Droid") }
                OutlinedButton(onClick = { onOpenUrl(com.ryuk.desktophub.termux.TermuxBridge.GITHUB_URL) }) { Text("GitHub") }
            }
        }

        StepCard(
            number = 2,
            title = "Abilita il collegamento con Termux",
            done = state.termuxReachable == true,
            text = "Copia il comando, apri Termux, tieni premuto sullo schermo → Incolla, poi premi Invio. " +
                "Serve una volta sola.",
        ) {
            CommandBox(Scripts.ENABLE_EXTERNAL_APPS)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(onClick = { onCopy(Scripts.ENABLE_EXTERNAL_APPS) }) {
                    Icon(Icons.Default.ContentCopy, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Copia comando")
                }
                OutlinedButton(onClick = onOpenTermux, enabled = state.termuxInstalled) { Text("Apri Termux") }
            }
        }

        StepCard(
            number = 3,
            title = "Concedi il permesso",
            done = state.permissionGranted,
            text = "Permette a Desktop Hub di chiedere a Termux di installare e avviare le app.",
        ) {
            Button(onClick = onRequestPermission, enabled = state.termuxInstalled && !state.permissionGranted) {
                Text(if (state.permissionGranted) "Permesso concesso" else "Concedi permesso")
            }
        }

        StepCard(
            number = 4,
            title = "Installa l'ambiente desktop",
            done = state.desktopReady,
            text = "Installa lo schermo virtuale e il desktop \"${state.environment.label}\". " +
                "Ci vogliono alcuni minuti e una connessione Wi-Fi: segui l'avanzamento in Termux.",
        ) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onRunSetup, enabled = state.termuxInstalled && state.permissionGranted) {
                    Text(if (state.desktopReady) "Reinstalla" else "Installa")
                }
                OutlinedButton(onClick = onGoToSettings) { Text("Cambia desktop") }
            }
        }

        StepCard(
            number = 5,
            title = "Accesso ai tuoi file (facoltativo)",
            done = false,
            optional = true,
            text = "Permette alle app desktop di aprire e salvare file nella memoria del telefono " +
                "(cartella ~/storage/shared).",
        ) {
            OutlinedButton(onClick = onSetupStorage, enabled = state.termuxInstalled && state.permissionGranted) {
                Text("Abilita accesso ai file")
            }
        }

        TipsCard()
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun DesktopCard(state: UiState, onLaunch: () -> Unit, onStop: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.DesktopWindows, null, Modifier.size(40.dp))
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("Il tuo desktop", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(
                        when {
                            state.desktopRunning -> "In esecuzione"
                            state.desktopReady -> "Pronto da avviare"
                            else -> "Completa la configurazione qui sotto"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = onLaunch, enabled = state.desktopReady && state.busyMessage == null) {
                    Text(if (state.desktopRunning) "Apri desktop" else "Avvia desktop")
                }
                if (state.desktopRunning) {
                    OutlinedButton(onClick = onStop, enabled = state.busyMessage == null) {
                        Icon(Icons.Default.Stop, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Ferma")
                    }
                }
                if (state.busyMessage != null) {
                    CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                }
            }
            state.busyMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}

@Composable
private fun StepCard(
    number: Int,
    title: String,
    done: Boolean,
    text: String,
    optional: Boolean = false,
    actions: @Composable () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (done) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                    contentDescription = if (done) "Completato" else "Da fare",
                    tint = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    "$number. $title" + if (optional) "" else "",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Text(text, style = MaterialTheme.typography.bodyMedium)
            actions()
        }
    }
}

@Composable
private fun CommandBox(command: String) {
    SelectionContainer {
        Text(
            command,
            fontFamily = FontFamily.Monospace,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                .padding(10.dp),
        )
    }
}

@Composable
private fun TipsCard() {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Consigli", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(
                "• Le app per computer funzionano meglio col telefono in orizzontale. Pizzica per lo zoom, " +
                    "due dita per scorrere, tieni premuto per il clic destro.",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "• Se il desktop si chiude da solo (Android 12 e successivi), attiva in Opzioni sviluppatore " +
                    "\"Disattiva restrizioni processi secondari\", oppure da PC: " +
                    "adb shell device_config put activity_manager max_phantom_processes 2147483647",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "• Escludi Termux dall'ottimizzazione batteria per evitare che il sistema lo chiuda.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
