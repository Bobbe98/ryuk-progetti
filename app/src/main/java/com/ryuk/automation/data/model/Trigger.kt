package com.ryuk.automation.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Something that can start an [Automation]. The companion [TriggerEvent] hierarchy
 * carries the live runtime data produced when a trigger actually fires.
 */
@Serializable
sealed class Trigger {

    @Serializable
    @SerialName("time_of_day")
    data class TimeOfDay(
        val hour: Int,
        val minute: Int,
        val daysOfWeek: Set<Int> = (1..7).toSet() // Calendar.SUNDAY=1 .. Calendar.SATURDAY=7
    ) : Trigger()

    @Serializable
    @SerialName("battery_level")
    data class BatteryLevel(val thresholdPercent: Int, val isBelow: Boolean) : Trigger()

    @Serializable
    @SerialName("power_connected")
    data class PowerConnected(val connected: Boolean) : Trigger()

    @Serializable
    @SerialName("wifi_state")
    data class WifiState(val connected: Boolean, val ssid: String? = null) : Trigger()

    @Serializable
    @SerialName("screen_state")
    data class ScreenState(val on: Boolean) : Trigger()

    @Serializable
    @SerialName("app_launched")
    data class AppLaunched(val packageName: String) : Trigger()

    @Serializable
    @SerialName("notification_posted")
    data class NotificationPosted(
        val packageName: String? = null,
        val textContains: String? = null
    ) : Trigger()

    @Serializable
    @SerialName("device_boot")
    data object DeviceBoot : Trigger()

    @Serializable
    @SerialName("sms_received")
    data class SmsReceived(val senderContains: String? = null) : Trigger()

    @Serializable
    @SerialName("manual")
    data object Manual : Trigger()

    fun label(): String = when (this) {
        is TimeOfDay -> "Ora del giorno"
        is BatteryLevel -> "Livello batteria"
        is PowerConnected -> "Stato carica"
        is WifiState -> "Stato Wi-Fi"
        is ScreenState -> "Stato schermo"
        is AppLaunched -> "App avviata"
        is NotificationPosted -> "Notifica ricevuta"
        is DeviceBoot -> "Avvio dispositivo"
        is SmsReceived -> "SMS ricevuto"
        is Manual -> "Avvio manuale"
    }
}

/** Runtime event emitted by a trigger source, used to match against stored [Trigger]s. */
sealed class TriggerEvent {
    data class TimeFired(val hour: Int, val minute: Int, val dayOfWeek: Int) : TriggerEvent()
    data class Battery(val percent: Int) : TriggerEvent()
    data class Power(val connected: Boolean) : TriggerEvent()
    data class Wifi(val connected: Boolean, val ssid: String?) : TriggerEvent()
    data class Screen(val on: Boolean) : TriggerEvent()
    data class AppLaunch(val packageName: String) : TriggerEvent()
    data class Notification(val packageName: String, val text: String) : TriggerEvent()
    data object Boot : TriggerEvent()
    data class Sms(val sender: String, val body: String) : TriggerEvent()
    data object ManualRun : TriggerEvent()
}
