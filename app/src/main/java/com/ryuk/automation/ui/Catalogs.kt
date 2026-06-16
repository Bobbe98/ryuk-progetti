package com.ryuk.automation.ui

import com.ryuk.automation.data.model.Action
import com.ryuk.automation.data.model.Condition
import com.ryuk.automation.data.model.RingerMode
import com.ryuk.automation.data.model.Trigger

/** Picker entries: a human label plus a factory producing a sensible default instance. */
data class CatalogEntry<T>(val label: String, val create: () -> T)

object TriggerCatalog {
    val entries: List<CatalogEntry<Trigger>> = listOf(
        CatalogEntry("Ora del giorno") { Trigger.TimeOfDay(8, 0) },
        CatalogEntry("Livello batteria") { Trigger.BatteryLevel(20, isBelow = true) },
        CatalogEntry("Stato carica") { Trigger.PowerConnected(connected = true) },
        CatalogEntry("Stato Wi-Fi") { Trigger.WifiState(connected = true) },
        CatalogEntry("Stato schermo") { Trigger.ScreenState(on = true) },
        CatalogEntry("App avviata") { Trigger.AppLaunched("") },
        CatalogEntry("Notifica ricevuta") { Trigger.NotificationPosted() },
        CatalogEntry("Avvio dispositivo") { Trigger.DeviceBoot },
        CatalogEntry("SMS ricevuto") { Trigger.SmsReceived() },
        CatalogEntry("Avvio manuale") { Trigger.Manual }
    )
}

object ConditionCatalog {
    val entries: List<CatalogEntry<Condition>> = listOf(
        CatalogEntry("Batteria sopra %") { Condition.BatteryAbove(50) },
        CatalogEntry("Batteria sotto %") { Condition.BatteryBelow(50) },
        CatalogEntry("Wi-Fi connesso") { Condition.WifiConnected(true) },
        CatalogEntry("Fascia orario") { Condition.TimeWindow(9, 0, 18, 0) },
        CatalogEntry("Giorno della settimana") { Condition.DayOfWeek((1..7).toSet()) }
    )
}

object ActionCatalog {
    val entries: List<CatalogEntry<Action>> = listOf(
        CatalogEntry("Mostra messaggio") { Action.ShowToast("Ciao!") },
        CatalogEntry("Mostra notifica") { Action.ShowNotification("Ryuk", "Automazione eseguita") },
        CatalogEntry("Apri app") { Action.OpenApp("") },
        CatalogEntry("Apri URL") { Action.OpenUrl("https://") },
        CatalogEntry("Modalità suoneria") { Action.SetRingerMode(RingerMode.SILENT) },
        CatalogEntry("Volume media") { Action.SetMediaVolume(50) },
        CatalogEntry("Attiva/disattiva Wi-Fi") { Action.ToggleWifi(true) },
        CatalogEntry("Attiva/disattiva Bluetooth") { Action.ToggleBluetooth(true) },
        CatalogEntry("Vibra") { Action.Vibrate(500) },
        CatalogEntry("Pronuncia testo") { Action.SpeakText("Ciao") },
        CatalogEntry("Invia SMS") { Action.SendSms("", "") },
        CatalogEntry("Attendi") { Action.Delay(1000) },
        CatalogEntry("Blocca schermo") { Action.LockScreen },
        CatalogEntry("Pannello modalità aereo") { Action.ToggleAirplaneModePanel }
    )
}

val DAY_LABELS = mapOf(1 to "Dom", 2 to "Lun", 3 to "Mar", 4 to "Mer", 5 to "Gio", 6 to "Ven", 7 to "Sab")
