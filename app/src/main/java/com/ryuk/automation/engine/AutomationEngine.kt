package com.ryuk.automation.engine

import android.content.Context
import android.util.Log
import com.ryuk.automation.data.model.Automation
import com.ryuk.automation.data.model.Trigger
import com.ryuk.automation.data.model.TriggerEvent
import com.ryuk.automation.data.repository.AutomationRepository

private const val TAG = "AutomationEngine"

/** Matches runtime [TriggerEvent]s against stored [Automation]s and runs their actions. */
class AutomationEngine(private val context: Context) {

    private val repository = AutomationRepository.get(context)
    private val deviceState = DeviceStateProvider(context)
    private val conditionEvaluator = ConditionEvaluator(deviceState)
    private val actionExecutor = ActionExecutor(context)

    suspend fun dispatch(event: TriggerEvent) {
        val automations = repository.getEnabled()
        for (automation in automations) {
            if (matches(automation.trigger, event) && conditionEvaluator.allPass(automation.conditions)) {
                Log.d(TAG, "Running automation '${automation.name}' for event $event")
                actionExecutor.executeAll(automation.actions)
                repository.touchLastRun(automation.id)
            }
        }
    }

    suspend fun runManually(automation: Automation) {
        if (conditionEvaluator.allPass(automation.conditions)) {
            actionExecutor.executeAll(automation.actions)
            repository.touchLastRun(automation.id)
        }
    }

    private fun matches(trigger: Trigger, event: TriggerEvent): Boolean = when (trigger) {
        is Trigger.TimeOfDay -> event is TriggerEvent.TimeFired &&
            trigger.hour == event.hour && trigger.minute == event.minute && event.dayOfWeek in trigger.daysOfWeek

        is Trigger.BatteryLevel -> event is TriggerEvent.Battery &&
            if (trigger.isBelow) event.percent <= trigger.thresholdPercent else event.percent >= trigger.thresholdPercent

        is Trigger.PowerConnected -> event is TriggerEvent.Power && event.connected == trigger.connected

        is Trigger.WifiState -> event is TriggerEvent.Wifi && event.connected == trigger.connected &&
            (trigger.ssid == null || trigger.ssid == event.ssid)

        is Trigger.ScreenState -> event is TriggerEvent.Screen && event.on == trigger.on

        is Trigger.AppLaunched -> event is TriggerEvent.AppLaunch && event.packageName == trigger.packageName

        is Trigger.NotificationPosted -> event is TriggerEvent.Notification &&
            (trigger.packageName == null || trigger.packageName == event.packageName) &&
            (trigger.textContains == null || event.text.contains(trigger.textContains, ignoreCase = true))

        is Trigger.DeviceBoot -> event is TriggerEvent.Boot

        is Trigger.SmsReceived -> event is TriggerEvent.Sms &&
            (trigger.senderContains == null || event.sender.contains(trigger.senderContains, ignoreCase = true))

        is Trigger.Manual -> event is TriggerEvent.ManualRun
    }
}
