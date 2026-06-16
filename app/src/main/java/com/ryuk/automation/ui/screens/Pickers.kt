package com.ryuk.automation.ui.screens

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import com.ryuk.automation.ui.CatalogEntry
import com.ryuk.automation.util.AppInfo

/** Dropdown button to pick one entry out of a catalog (used for trigger/condition/action kind). */
@Composable
fun <T> KindPicker(label: String, entries: List<CatalogEntry<T>>, onPicked: (T) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    OutlinedButton(onClick = { expanded = true }) {
        Text(label)
        Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
    }
    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
        entries.forEach { entry ->
            DropdownMenuItem(
                text = { Text(entry.label) },
                onClick = {
                    expanded = false
                    onPicked(entry.create())
                }
            )
        }
    }
}

@Composable
fun AppPickerDialog(apps: List<AppInfo>, onPicked: (AppInfo) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Scegli un'app") },
        text = {
            LazyColumn {
                items(apps, key = { it.packageName }) { app ->
                    TextButton(onClick = { onPicked(app) }) {
                        Text(app.label, modifier = androidx.compose.ui.Modifier.padding(vertical = 4.dp))
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annulla") } }
    )
}
