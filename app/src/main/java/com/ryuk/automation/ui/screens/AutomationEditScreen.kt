package com.ryuk.automation.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Card
import androidx.compose.material3.Divider
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.ryuk.automation.data.model.Action
import com.ryuk.automation.data.model.Automation
import com.ryuk.automation.data.model.Condition
import com.ryuk.automation.data.model.RingerMode
import com.ryuk.automation.data.model.Trigger
import com.ryuk.automation.ui.ActionCatalog
import com.ryuk.automation.ui.ConditionCatalog
import com.ryuk.automation.ui.DAY_LABELS
import com.ryuk.automation.ui.TriggerCatalog
import com.ryuk.automation.util.InstalledApps
import com.ryuk.automation.viewmodel.AutomationViewModel

@Composable
fun AutomationEditScreen(viewModel: AutomationViewModel, automationId: Long, onDone: () -> Unit) {
    val automations by viewModel.automations.collectAsState()
    val existing = remember(automationId, automations) { automations.find { it.id == automationId } }

    var name by remember(existing) { mutableStateOf(existing?.name ?: "") }
    var trigger by remember(existing) { mutableStateOf(existing?.trigger ?: Trigger.Manual) }
    var conditions by remember(existing) { mutableStateOf(existing?.conditions ?: emptyList()) }
    var actions by remember(existing) { mutableStateOf(existing?.actions ?: emptyList()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (existing == null) "Nuova automazione" else "Modifica automazione") },
                navigationIcon = { IconButton(onClick = onDone) { Icon(Icons.Filled.ArrowBack, contentDescription = "Indietro") } },
                actions = {
                    IconButton(onClick = {
                        if (name.isNotBlank() && actions.isNotEmpty()) {
                            viewModel.save(
                                Automation(
                                    id = existing?.id ?: 0,
                                    name = name,
                                    enabled = existing?.enabled ?: true,
                                    trigger = trigger,
                                    conditions = conditions,
                                    actions = actions
                                )
                            )
                            onDone()
                        }
                    }) { Icon(Icons.Filled.Save, contentDescription = "Salva") }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nome automazione") }, modifier = Modifier.fillMaxWidth())

            SectionTitle("Trigger")
            KindPicker("Cambia trigger: ${trigger.label()}", TriggerCatalog.entries) { trigger = it }
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    TriggerFields(trigger = trigger, onChange = { trigger = it })
                }
            }

            SectionTitle("Condizioni (opzionali)")
            conditions.forEachIndexed { index, condition ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Text(condition.label(), modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                            IconButton(onClick = { conditions = conditions.toMutableList().also { it.removeAt(index) } }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Rimuovi condizione")
                            }
                        }
                        ConditionFields(condition = condition, onChange = { updated ->
                            conditions = conditions.toMutableList().also { it[index] = updated }
                        })
                    }
                }
            }
            KindPicker("Aggiungi condizione", ConditionCatalog.entries) { conditions = conditions + it }

            SectionTitle("Azioni")
            actions.forEachIndexed { index, action ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Text("${index + 1}. ${action.label()}", modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                            IconButton(onClick = { actions = actions.toMutableList().also { it.removeAt(index) } }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Rimuovi azione")
                            }
                        }
                        ActionFields(action = action, onChange = { updated ->
                            actions = actions.toMutableList().also { it[index] = updated }
                        })
                    }
                }
            }
            KindPicker("Aggiungi azione", ActionCatalog.entries) { actions = actions + it }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium)
    Divider()
}

@Composable
private fun TriggerFields(trigger: Trigger, onChange: (Trigger) -> Unit) {
    when (trigger) {
        is Trigger.TimeOfDay -> {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("Ora", trigger.hour, 0, 23) { onChange(trigger.copy(hour = it)) }
                NumberField("Minuto", trigger.minute, 0, 59) { onChange(trigger.copy(minute = it)) }
            }
            DayChips(trigger.daysOfWeek) { onChange(trigger.copy(daysOfWeek = it)) }
        }
        is Trigger.BatteryLevel -> {
            NumberField("Soglia %", trigger.thresholdPercent, 0, 100) { onChange(trigger.copy(thresholdPercent = it)) }
            ToggleChips(listOf("Sotto" to true, "Sopra" to false), trigger.isBelow) { onChange(trigger.copy(isBelow = it)) }
        }
        is Trigger.PowerConnected -> ToggleChips(listOf("Connesso" to true, "Disconnesso" to false), trigger.connected) { onChange(trigger.copy(connected = it)) }
        is Trigger.WifiState -> {
            ToggleChips(listOf("Connesso" to true, "Disconnesso" to false), trigger.connected) { onChange(trigger.copy(connected = it)) }
            OutlinedTextField(
                value = trigger.ssid ?: "",
                onValueChange = { onChange(trigger.copy(ssid = it.ifBlank { null })) },
                label = { Text("SSID (opzionale)") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        is Trigger.ScreenState -> ToggleChips(listOf("Acceso" to true, "Spento" to false), trigger.on) { onChange(trigger.copy(on = it)) }
        is Trigger.AppLaunched -> AppPickerFieldSingle(selectedPackage = trigger.packageName) { onChange(trigger.copy(packageName = it)) }
        is Trigger.NotificationPosted -> {
            AppPickerFieldSingle(selectedPackage = trigger.packageName ?: "") { onChange(trigger.copy(packageName = it.ifBlank { null })) }
            OutlinedTextField(
                value = trigger.textContains ?: "",
                onValueChange = { onChange(trigger.copy(textContains = it.ifBlank { null })) },
                label = { Text("Testo contenuto (opzionale)") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        is Trigger.SmsReceived -> OutlinedTextField(
            value = trigger.senderContains ?: "",
            onValueChange = { onChange(trigger.copy(senderContains = it.ifBlank { null })) },
            label = { Text("Mittente contiene (opzionale)") },
            modifier = Modifier.fillMaxWidth()
        )
        is Trigger.DeviceBoot -> Text("Si attiva all'avvio del dispositivo.", style = MaterialTheme.typography.bodySmall)
        is Trigger.Manual -> Text("Si attiva solo premendo \"Esegui ora\" nella lista.", style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun ConditionFields(condition: Condition, onChange: (Condition) -> Unit) {
    when (condition) {
        is Condition.BatteryAbove -> NumberField("Percentuale", condition.percent, 0, 100) { onChange(condition.copy(percent = it)) }
        is Condition.BatteryBelow -> NumberField("Percentuale", condition.percent, 0, 100) { onChange(condition.copy(percent = it)) }
        is Condition.WifiConnected -> ToggleChips(listOf("Connesso" to true, "Disconnesso" to false), condition.connected) { onChange(condition.copy(connected = it)) }
        is Condition.TimeWindow -> {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("Da ora", condition.startHour, 0, 23) { onChange(condition.copy(startHour = it)) }
                NumberField("Da min", condition.startMinute, 0, 59) { onChange(condition.copy(startMinute = it)) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("A ora", condition.endHour, 0, 23) { onChange(condition.copy(endHour = it)) }
                NumberField("A min", condition.endMinute, 0, 59) { onChange(condition.copy(endMinute = it)) }
            }
        }
        is Condition.DayOfWeek -> DayChips(condition.days) { onChange(condition.copy(days = it)) }
    }
}

@Composable
private fun ActionFields(action: Action, onChange: (Action) -> Unit) {
    when (action) {
        is Action.ShowToast -> OutlinedTextField(action.text, { onChange(action.copy(text = it)) }, label = { Text("Testo") }, modifier = Modifier.fillMaxWidth())
        is Action.ShowNotification -> Column {
            OutlinedTextField(action.title, { onChange(action.copy(title = it)) }, label = { Text("Titolo") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(action.text, { onChange(action.copy(text = it)) }, label = { Text("Testo") }, modifier = Modifier.fillMaxWidth())
        }
        is Action.OpenApp -> AppPickerField(selectedPackage = action.packageName, selectedLabel = action.appLabel) { pkg, label -> onChange(action.copy(packageName = pkg, appLabel = label)) }
        is Action.OpenUrl -> OutlinedTextField(action.url, { onChange(action.copy(url = it)) }, label = { Text("URL") }, modifier = Modifier.fillMaxWidth())
        is Action.SetRingerMode -> ToggleChips(
            listOf("Normale" to RingerMode.NORMAL, "Vibrazione" to RingerMode.VIBRATE, "Silenzioso" to RingerMode.SILENT),
            action.mode
        ) { onChange(action.copy(mode = it)) }
        is Action.SetMediaVolume -> NumberField("Volume %", action.percent, 0, 100) { onChange(action.copy(percent = it)) }
        is Action.ToggleWifi -> ToggleChips(listOf("Attiva" to true, "Disattiva" to false), action.enable) { onChange(action.copy(enable = it)) }
        is Action.ToggleBluetooth -> ToggleChips(listOf("Attiva" to true, "Disattiva" to false), action.enable) { onChange(action.copy(enable = it)) }
        is Action.Vibrate -> NumberField("Millisecondi", action.durationMs.toInt(), 0, 60_000) { onChange(action.copy(durationMs = it.toLong())) }
        is Action.SpeakText -> OutlinedTextField(action.text, { onChange(action.copy(text = it)) }, label = { Text("Testo da pronunciare") }, modifier = Modifier.fillMaxWidth())
        is Action.SendSms -> Column {
            OutlinedTextField(action.number, { onChange(action.copy(number = it)) }, label = { Text("Numero") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(action.text, { onChange(action.copy(text = it)) }, label = { Text("Testo") }, modifier = Modifier.fillMaxWidth())
        }
        is Action.Delay -> NumberField("Millisecondi", action.durationMs.toInt(), 0, 600_000) { onChange(action.copy(durationMs = it.toLong())) }
        is Action.LockScreen -> Text("Blocca lo schermo (richiede servizio di Accessibilità attivo).", style = MaterialTheme.typography.bodySmall)
        is Action.ToggleAirplaneModePanel -> Text("Apre le impostazioni di modalità aereo.", style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun NumberField(label: String, value: Int, min: Int, max: Int, onChange: (Int) -> Unit) {
    OutlinedTextField(
        value = value.toString(),
        onValueChange = { text -> text.toIntOrNull()?.let { onChange(it.coerceIn(min, max)) } },
        label = { Text(label) },
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun <T> ToggleChips(options: List<Pair<String, T>>, selected: T, onSelect: (T) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (label, value) ->
            FilterChip(selected = value == selected, onClick = { onSelect(value) }, label = { Text(label) })
        }
    }
}

@Composable
private fun DayChips(selected: Set<Int>, onChange: (Set<Int>) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        DAY_LABELS.forEach { (day, label) ->
            FilterChip(
                selected = day in selected,
                onClick = { onChange(if (day in selected) selected - day else selected + day) },
                label = { Text(label) }
            )
        }
    }
}

@Composable
private fun AppPickerField(selectedPackage: String, selectedLabel: String = "", onPicked: (String, String) -> Unit) {
    AppPickerField(selectedPackage, selectedLabel, onSingle = null, onPicked = onPicked)
}

@Composable
private fun AppPickerFieldSingle(selectedPackage: String, onPicked: (String) -> Unit) {
    AppPickerField(selectedPackage, "", onSingle = onPicked, onPicked = { _, _ -> })
}

@Composable
private fun AppPickerField(
    selectedPackage: String,
    selectedLabel: String,
    onSingle: ((String) -> Unit)?,
    onPicked: (String, String) -> Unit
) {
    val context = LocalContext.current
    var showDialog by remember { mutableStateOf(false) }
    val apps = remember { InstalledApps.launchable(context) }

    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = selectedLabel.ifBlank { selectedPackage }.ifBlank { "Nessuna app selezionata" },
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodyMedium
        )
        androidx.compose.material3.TextButton(onClick = { showDialog = true }) { Text("Scegli app") }
    }

    if (showDialog) {
        AppPickerDialog(
            apps = apps,
            onPicked = { app ->
                showDialog = false
                onSingle?.invoke(app.packageName) ?: onPicked(app.packageName, app.label)
            },
            onDismiss = { showDialog = false }
        )
    }
}
