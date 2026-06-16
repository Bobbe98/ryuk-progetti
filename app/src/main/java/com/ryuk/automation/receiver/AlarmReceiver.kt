package com.ryuk.automation.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.ryuk.automation.data.model.Trigger
import com.ryuk.automation.data.model.TriggerEvent
import com.ryuk.automation.data.repository.AutomationRepository
import com.ryuk.automation.engine.AlarmScheduler
import com.ryuk.automation.engine.AutomationEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Fired by [AlarmScheduler] for [Trigger.TimeOfDay] triggers; reschedules itself for next week. */
class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val automationId = intent.getLongExtra(EXTRA_AUTOMATION_ID, -1)
        val hour = intent.getIntExtra(EXTRA_HOUR, -1)
        val minute = intent.getIntExtra(EXTRA_MINUTE, -1)
        val dayOfWeek = intent.getIntExtra(EXTRA_DAY_OF_WEEK, -1)
        if (automationId < 0) return

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.Default).launch {
            try {
                val repository = AutomationRepository.get(context)
                val automation = repository.getById(automationId)
                val trigger = automation?.trigger as? Trigger.TimeOfDay
                val stillValid = automation != null && automation.enabled && trigger != null &&
                    trigger.hour == hour && trigger.minute == minute && dayOfWeek in trigger.daysOfWeek

                if (stillValid) {
                    AutomationEngine(context).dispatch(TriggerEvent.TimeFired(hour, minute, dayOfWeek))
                    AlarmScheduler.scheduleNext(context, automationId, hour, minute, dayOfWeek)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        const val EXTRA_AUTOMATION_ID = "automationId"
        const val EXTRA_HOUR = "hour"
        const val EXTRA_MINUTE = "minute"
        const val EXTRA_DAY_OF_WEEK = "dayOfWeek"
    }
}
