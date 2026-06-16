package com.ryuk.automation.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Something an [Automation] performs when its trigger fires and conditions pass. */
@Serializable
sealed class Action {

    @Serializable
    @SerialName("show_toast")
    data class ShowToast(val text: String) : Action()

    @Serializable
    @SerialName("show_notification")
    data class ShowNotification(val title: String, val text: String) : Action()

    @Serializable
    @SerialName("open_app")
    data class OpenApp(val packageName: String, val appLabel: String = "") : Action()

    @Serializable
    @SerialName("open_url")
    data class OpenUrl(val url: String) : Action()

    @Serializable
    @SerialName("set_ringer_mode")
    data class SetRingerMode(val mode: RingerMode) : Action()

    @Serializable
    @SerialName("set_media_volume")
    data class SetMediaVolume(val percent: Int) : Action()

    @Serializable
    @SerialName("toggle_wifi")
    data class ToggleWifi(val enable: Boolean) : Action()

    @Serializable
    @SerialName("toggle_bluetooth")
    data class ToggleBluetooth(val enable: Boolean) : Action()

    @Serializable
    @SerialName("vibrate")
    data class Vibrate(val durationMs: Long) : Action()

    @Serializable
    @SerialName("speak_text")
    data class SpeakText(val text: String) : Action()

    @Serializable
    @SerialName("send_sms")
    data class SendSms(val number: String, val text: String) : Action()

    @Serializable
    @SerialName("delay")
    data class Delay(val durationMs: Long) : Action()

    @Serializable
    @SerialName("lock_screen")
    data object LockScreen : Action()

    @Serializable
    @SerialName("toggle_airplane_mode_panel")
    data object ToggleAirplaneModePanel : Action()

    fun label(): String = when (this) {
        is ShowToast -> "Mostra messaggio: \"$text\""
        is ShowNotification -> "Notifica: \"$title\""
        is OpenApp -> "Apri app ${appLabel.ifBlank { packageName }}"
        is OpenUrl -> "Apri URL $url"
        is SetRingerMode -> "Modalità suoneria: ${mode.label}"
        is SetMediaVolume -> "Volume media a $percent%"
        is ToggleWifi -> if (enable) "Attiva Wi-Fi" else "Disattiva Wi-Fi"
        is ToggleBluetooth -> if (enable) "Attiva Bluetooth" else "Disattiva Bluetooth"
        is Vibrate -> "Vibra per ${durationMs}ms"
        is SpeakText -> "Pronuncia: \"$text\""
        is SendSms -> "Invia SMS a $number"
        is Delay -> "Attendi ${durationMs}ms"
        is LockScreen -> "Blocca schermo"
        is ToggleAirplaneModePanel -> "Apri pannello modalità aereo"
    }
}

@Serializable
enum class RingerMode(val label: String) { NORMAL("Normale"), VIBRATE("Vibrazione"), SILENT("Silenzioso") }
