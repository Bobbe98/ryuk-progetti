package com.ryuk.desktophub.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Brush
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Window
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ryuk.desktophub.UiState
import com.ryuk.desktophub.data.Category
import com.ryuk.desktophub.data.DesktopApp

@Composable
fun AppsScreen(
    state: UiState,
    onInstall: (DesktopApp) -> Unit,
    onUninstall: (DesktopApp) -> Unit,
    onLaunch: (DesktopApp) -> Unit,
    onRemoveCustom: (DesktopApp) -> Unit,
    modifier: Modifier = Modifier,
) {
    var filter by rememberSaveable { mutableStateOf<String?>(null) }
    var showInstalledOnly by rememberSaveable { mutableStateOf(false) }
    var confirmUninstall by remember { mutableStateOf<DesktopApp?>(null) }

    val categories = Category.entries.filter { c -> state.apps.any { it.category == c } }
    val visible = state.apps
        .filter { filter == null || it.category.name == filter }
        .filter { !showInstalledOnly || it.id in state.installed }
        .sortedByDescending { it.id in state.installed }

    Column(modifier.fillMaxSize()) {
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                FilterChip(
                    selected = showInstalledOnly,
                    onClick = { showInstalledOnly = !showInstalledOnly },
                    label = { Text("Installate") },
                )
            }
            item {
                FilterChip(selected = filter == null, onClick = { filter = null }, label = { Text("Tutte") })
            }
            items(categories) { c ->
                FilterChip(
                    selected = filter == c.name,
                    onClick = { filter = if (filter == c.name) null else c.name },
                    label = { Text(c.label) },
                )
            }
        }

        if (!state.desktopReady) {
            Text(
                "Completa prima la configurazione nella scheda Inizia: poi potrai installare e aprire le app.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }

        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(visible, key = { it.id }) { app ->
                AppCard(
                    app = app,
                    installed = app.id in state.installed,
                    canAct = state.termuxInstalled && state.permissionGranted,
                    canLaunch = state.desktopReady && state.busyMessage == null,
                    onInstall = { onInstall(app) },
                    onUninstall = { confirmUninstall = app },
                    onLaunch = { onLaunch(app) },
                    onRemoveCustom = { onRemoveCustom(app) },
                )
            }
            if (visible.isEmpty()) {
                item {
                    Text(
                        "Nessuna app qui. Usa \"Aggiungi\" per installare un pacchetto Termux qualsiasi.",
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
        }
    }

    confirmUninstall?.let { app ->
        AlertDialog(
            onDismissRequest = { confirmUninstall = null },
            title = { Text("Rimuovere ${app.name}?") },
            text = { Text("L'app verrà disinstallata da Termux. I tuoi file non vengono toccati.") },
            confirmButton = {
                TextButton(onClick = { onUninstall(app); confirmUninstall = null }) { Text("Rimuovi") }
            },
            dismissButton = { TextButton(onClick = { confirmUninstall = null }) { Text("Annulla") } },
        )
    }
}

private fun Category.icon(): ImageVector = when (this) {
    Category.INTERNET -> Icons.Default.Language
    Category.OFFICE -> Icons.Default.Description
    Category.GRAPHICS -> Icons.Default.Brush
    Category.DEV -> Icons.Default.Code
    Category.MEDIA -> Icons.Default.MusicNote
    Category.UTILITY -> Icons.Default.Build
    Category.WINDOWS -> Icons.Default.Window
    Category.CUSTOM -> Icons.Default.Extension
}

@Composable
private fun AppCard(
    app: DesktopApp,
    installed: Boolean,
    canAct: Boolean,
    canLaunch: Boolean,
    onInstall: () -> Unit,
    onUninstall: () -> Unit,
    onLaunch: () -> Unit,
    onRemoveCustom: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(app.category.icon(), null, Modifier.size(32.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(app.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(
                        listOfNotNull(app.category.label, app.size.ifBlank { null }).joinToString(" · "),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Text(app.description, style = MaterialTheme.typography.bodyMedium)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (installed) AssistChip(onClick = {}, label = { Text("Installata") })
                if (app.experimental) AssistChip(onClick = {}, label = { Text("Sperimentale") })
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (installed) {
                    Button(onClick = onLaunch, enabled = canLaunch) {
                        Icon(Icons.AutoMirrored.Filled.OpenInNew, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Apri")
                    }
                    if (!app.windowsProgram) {
                        TextButton(onClick = onUninstall, enabled = canAct) { Text("Disinstalla") }
                    }
                } else {
                    FilledTonalButton(onClick = onInstall, enabled = canAct) { Text("Installa") }
                }
                if (app.custom) TextButton(onClick = onRemoveCustom) { Text("Togli dalla lista") }
            }
        }
    }
}

@Composable
fun AddCustomAppDialog(onDismiss: () -> Unit, onAdd: (name: String, packages: String, launch: String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var packages by remember { mutableStateOf("") }
    var launch by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Aggiungi un'app") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Qualsiasi programma disponibile come pacchetto Termux (cercalo con \"pkg search nome\").",
                    style = MaterialTheme.typography.bodySmall,
                )
                OutlinedTextField(name, { name = it }, label = { Text("Nome") }, singleLine = true)
                OutlinedTextField(
                    packages, { packages = it },
                    label = { Text("Pacchetti (es. xpdf)") }, singleLine = true,
                )
                OutlinedTextField(
                    launch, { launch = it },
                    label = { Text("Comando di avvio (es. xpdf)") }, singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onAdd(name, packages, launch.ifBlank { packages.trim().substringBefore(' ') }) },
                enabled = name.isNotBlank() && packages.isNotBlank(),
            ) { Text("Aggiungi") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annulla") } },
    )
}
