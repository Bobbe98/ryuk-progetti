package com.ryuk.automation.engine

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.ryuk.automation.data.model.Automation
import com.ryuk.automation.data.model.Trigger
import com.ryuk.automation.receiver.AlarmReceiver
import java.util.Calendar

/** Schedules/cancels exact alarms backing [Trigger.TimeOfDay] triggers, one per day of week. */
object AlarmScheduler {

    fun requestCodeFor(automationId: Long, dayOfWeek: Int): Int = (automationId * 10 + dayOfWeek).toInt()

    fun rescheduleAll(context: Context, automations: List<Automation>) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (automation in automations) {
            val trigger = automation.trigger as? Trigger.TimeOfDay ?: continue
            for (day in 1..7) {
                val requestCode = requestCodeFor(automation.id, day)
                cancel(context, alarmManager, requestCode)
                if (automation.enabled && day in trigger.daysOfWeek) {
                    scheduleNext(context, automation.id, trigger.hour, trigger.minute, day)
                }
            }
        }
    }

    fun scheduleNext(context: Context, automationId: Long, hour: Int, minute: Int, dayOfWeek: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = nextOccurrence(hour, minute, dayOfWeek)
        val pendingIntent = pendingIntentFor(context, automationId, hour, minute, dayOfWeek)
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }

    private fun cancel(context: Context, alarmManager: AlarmManager, requestCode: Int) {
        val intent = Intent(context, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    private fun pendingIntentFor(context: Context, automationId: Long, hour: Int, minute: Int, dayOfWeek: Int): PendingIntent {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra(AlarmReceiver.EXTRA_AUTOMATION_ID, automationId)
            putExtra(AlarmReceiver.EXTRA_HOUR, hour)
            putExtra(AlarmReceiver.EXTRA_MINUTE, minute)
            putExtra(AlarmReceiver.EXTRA_DAY_OF_WEEK, dayOfWeek)
        }
        return PendingIntent.getBroadcast(
            context, requestCodeFor(automationId, dayOfWeek), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun nextOccurrence(hour: Int, minute: Int, dayOfWeek: Int): Long {
        val now = Calendar.getInstance()
        val candidate = Calendar.getInstance().apply {
            set(Calendar.DAY_OF_WEEK, dayOfWeek)
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (candidate.timeInMillis <= now.timeInMillis) {
            candidate.add(Calendar.DAY_OF_YEAR, 7)
        }
        return candidate.timeInMillis
    }
}
