package com.ryuk.automation.engine

import com.ryuk.automation.data.model.Condition
import java.util.Calendar

class ConditionEvaluator(private val deviceState: DeviceStateProvider) {

    fun allPass(conditions: List<Condition>): Boolean = conditions.all { passes(it) }

    private fun passes(condition: Condition): Boolean = when (condition) {
        is Condition.BatteryAbove -> deviceState.batteryPercent() > condition.percent
        is Condition.BatteryBelow -> deviceState.batteryPercent() < condition.percent
        is Condition.WifiConnected -> deviceState.isWifiConnected() == condition.connected
        is Condition.TimeWindow -> isWithinWindow(condition)
        is Condition.DayOfWeek -> Calendar.getInstance().get(Calendar.DAY_OF_WEEK) in condition.days
    }

    private fun isWithinWindow(window: Condition.TimeWindow): Boolean {
        val now = Calendar.getInstance()
        val nowMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val start = window.startHour * 60 + window.startMinute
        val end = window.endHour * 60 + window.endMinute
        return if (start <= end) nowMinutes in start..end else nowMinutes >= start || nowMinutes <= end
    }
}
