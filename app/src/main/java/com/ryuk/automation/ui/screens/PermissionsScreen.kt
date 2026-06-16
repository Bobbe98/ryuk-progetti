package com.ryuk.automation.ui.screens

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.ryuk.automation.util.PermissionUtils

private data class PermissionItem(
    val title: String,
    val description: String,
    val isGranted: (Context) -> Boolean,
    val request: (Context) -> Unit
)

@Composable
fun PermissionsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var refreshKey by remember { mutableStateOf(0) }

    val runtimePermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { refreshKey++ }

    val items = remember(refreshKey) {
        listOf(
            PermissionItem(
                "Servizio di Accessibilità",
                "Necessario per il trigger \"App avviata\" e l'azione \"Blocca schermo\"",
                { PermissionUtils.isAccessibilityServiceEnabled(it) },
                { it.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
            ),
            PermissionItem(
                "Accesso alle notifiche",
                "Necessario per il trigger \"Notifica ricevuta\"",
                { PermissionUtils.isNotificationListenerEnabled(it) },
                { it.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
            ),
            PermissionItem(
                "Ignora ottimizzazione batteria",
                "Evita che il sistema chiuda il motore di automazione in background",
                { PermissionUtils.isIgnoringBatteryOptimizations(it) },
                {
                    it.startActivity(
                        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${it.packageName}"))
                    )
                }
            ),
            PermissionItem(
                "Accesso Non disturbare",
                "Necessario per l'azione \"Modalità suoneria\" (silenzioso/vibrazione)",
                {
                    val nm = it.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    nm.isNotificationPolicyAccessGranted
                },
                { it.startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)) }
            ),
            PermissionItem(
                "Notifiche, SMS e promemoria",
                "Permessi runtime per notifiche, invio/ricezione SMS",
                { ctx ->
                    val perms = mutableListOf(android.Manifest.permission.SEND_SMS, android.Manifest.permission.RECEIVE_SMS)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) perms += android.Manifest.permission.POST_NOTIFICATIONS
                    perms.all { ContextCompat.checkSelfPermission(ctx, it) == android.content.pm.PackageManager.PERMISSION_GRANTED }
                },
                {
                    val perms = mutableListOf(android.Manifest.permission.SEND_SMS, android.Manifest.permission.RECEIVE_SMS)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) perms += android.Manifest.permission.POST_NOTIFICATIONS
                    runtimePermissionLauncher.launch(perms.toTypedArray())
                }
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Permessi") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Indietro") }
                }
            )
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.padding(padding)) {
            items(items) { item ->
                val granted = item.isGranted(context)
                Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp)) {
                    Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            if (granted) Icons.Filled.Check else Icons.Filled.Close,
                            contentDescription = null
                        )
                        Column(modifier = Modifier.weight(1f).padding(start = 8.dp)) {
                            Text(item.title, style = MaterialTheme.typography.titleSmall)
                            Text(item.description, style = MaterialTheme.typography.bodySmall)
                        }
                        if (!granted) {
                            TextButton(onClick = { item.request(context); refreshKey++ }) { Text("Concedi") }
                        }
                    }
                }
            }
        }
    }
}

