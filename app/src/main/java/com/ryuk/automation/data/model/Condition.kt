package com.ryuk.automation.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Extra guard checked at trigger time, in addition to the [Trigger] itself. */
@Serializable
sealed class Condition {

    @Serializable
    @SerialName("battery_above")
    data class BatteryAbove(val percent: Int) : Condition()

    @Serializable
    @SerialName("battery_below")
    data class BatteryBelow(val percent: Int) : Condition()

    @Serializable
    @SerialName("wifi_connected")
    data class WifiConnected(val connected: Boolean) : Condition()

    @Serializable
    @SerialName("time_window")
    data class TimeWindow(val startHour: Int, val startMinute: Int, val endHour: Int, val endMinute: Int) : Condition()

    @Serializable
    @SerialName("day_of_week")
    data class DayOfWeek(val days: Set<Int>) : Condition()

    fun label(): String = when (this) {
        is BatteryAbove -> "Batteria sopra $percent%"
        is BatteryBelow -> "Batteria sotto $percent%"
        is WifiConnected -> if (connected) "Wi-Fi connesso" else "Wi-Fi disconnesso"
        is TimeWindow -> "Tra le %02d:%02d e le %02d:%02d".format(startHour, startMinute, endHour, endMinute)
        is DayOfWeek -> "Giorni selezionati"
    }
}
