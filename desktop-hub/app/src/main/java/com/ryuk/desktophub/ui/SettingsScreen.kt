package com.ryuk.desktophub.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ryuk.desktophub.UiState
import com.ryuk.desktophub.data.DesktopEnvironment
import com.ryuk.desktophub.data.InputMode
import com.ryuk.desktophub.data.Resolution
import com.ryuk.desktophub.termux.Scripts

@Composable
fun SettingsScreen(
    state: UiState,
    vncPassword: String,
    desktopSize: Pair<Int, Int>,
    onEnvironment: (DesktopEnvironment) -> Unit,
    onResolution: (Resolution) -> Unit,
    onInputMode: (InputMode) -> Unit,
    onStopDesktop: () -> Unit,
    onInstallEnvironment: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Section("Ambiente desktop") {
            DesktopEnvironment.entries.forEach { env ->
                Choice(
                    selected = state.environment == env,
                    title = env.label + if (env in state.environmentsInstalled) " · installato" else "",
                    subtitle = env.description,
                    onClick = { onEnvironment(env) },
                )
            }
            if (state.environment !in state.environmentsInstalled && state.termuxReachable == true) {
                OutlinedButton(onClick = onInstallEnvironment) { Text("Installa ${state.environment.label}") }
            }
            Text(
                "Il cambio vale dal prossimo avvio del desktop.",
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Section("Risoluzione del desktop") {
            Resolution.entries.forEach { res ->
                Choice(
                    selected = state.resolution == res,
                    title = res.label,
                    subtitle = "Larghezza ${res.width} px",
                    onClick = { onResolution(res) },
                )
            }
            Text(
                "Attuale: ${desktopSize.first} × ${desktopSize.second}. Una risoluzione più bassa rende " +
                    "testo e pulsanti più grandi.",
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Section("Controllo con il tocco") {
            Choice(
                selected = state.inputMode == InputMode.TOUCH,
                title = InputMode.TOUCH.label,
                subtitle = "Tocchi direttamente dove vuoi cliccare. Tieni premuto = clic destro.",
                onClick = { onInputMode(InputMode.TOUCH) },
            )
            Choice(
                selected = state.inputMode == InputMode.TOUCHPAD,
                title = InputMode.TOUCHPAD.label,
                subtitle = "Il dito muove il puntatore come sul touchpad di un portatile: più preciso. " +
                    "Due dita toccano = clic destro.",
                onClick = { onInputMode(InputMode.TOUCHPAD) },
            )
        }

        Section("Desktop in esecuzione") {
            OutlinedButton(onClick = onStopDesktop, enabled = state.busyMessage == null) {
                Text("Chiudi desktop e tutte le app")
            }
        }

        Section("Visualizzatore esterno (facoltativo)") {
            Text(
                "Puoi collegarti al desktop anche con un'altra app VNC sullo stesso telefono:",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "Indirizzo: 127.0.0.1:${Scripts.VNC_PORT}\nPassword: $vncPassword",
                fontFamily = FontFamily.Monospace,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        Section("Come funziona") {
            Text(
                "Desktop Hub usa Termux come motore Linux: installa i veri programmi per computer " +
                    "(versioni Linux per processori ARM) e li fa girare su uno schermo virtuale, che " +
                    "l'app mostra a tutto schermo. Tutto resta sul telefono: il desktop accetta solo " +
                    "connessioni locali protette da password. I programmi Windows (.exe) passano da " +
                    "Wine e funzionano solo in parte.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}

@Composable
private fun Choice(selected: Boolean, title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = null)
        Column(Modifier.padding(start = 8.dp)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
