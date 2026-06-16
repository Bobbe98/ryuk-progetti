package com.ryuk.automation.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ryuk.automation.data.model.Automation
import com.ryuk.automation.viewmodel.AutomationViewModel

@Composable
fun AutomationListScreen(
    viewModel: AutomationViewModel,
    onCreateNew: () -> Unit,
    onEdit: (Long) -> Unit,
    onOpenPermissions: () -> Unit
) {
    val automations by viewModel.automations.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ryuk Automation") },
                actions = {
                    IconButton(onClick = onOpenPermissions) {
                        Icon(Icons.Filled.Security, contentDescription = "Permessi")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onCreateNew) {
                Icon(Icons.Filled.Add, contentDescription = "Nuova automazione")
            }
        }
    ) { padding ->
        if (automations.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("Nessuna automazione ancora. Tocca + per crearne una.", style = MaterialTheme.typography.bodyLarge)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(automations, key = { it.id }) { automation ->
                    AutomationRow(
                        automation = automation,
                        onToggle = { enabled -> viewModel.setEnabled(automation, enabled) },
                        onClick = { onEdit(automation.id) },
                        onDelete = { viewModel.delete(automation) },
                        onRun = { viewModel.runManually(automation) }
                    )
                }
            }
        }
    }
}

@Composable
private fun AutomationRow(
    automation: Automation,
    onToggle: (Boolean) -> Unit,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onRun: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
        colors = CardDefaults.cardColors(),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(automation.name, style = MaterialTheme.typography.titleMedium)
                Text(automation.trigger.label(), style = MaterialTheme.typography.bodySmall)
                Text("${automation.actions.size} azioni", style = MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick = onRun) {
                Icon(Icons.Filled.PlayArrow, contentDescription = "Esegui ora")
            }
            Switch(checked = automation.enabled, onCheckedChange = onToggle)
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "Elimina")
            }
        }
    }
}
