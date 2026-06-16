package com.ryuk.automation.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.ryuk.automation.data.model.TriggerEvent
import com.ryuk.automation.data.repository.AutomationRepository
import com.ryuk.automation.engine.AlarmScheduler
import com.ryuk.automation.engine.AutomationEngine
import com.ryuk.automation.service.AutomationForegroundService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        AutomationForegroundService.start(context)

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.Default).launch {
            try {
                val repository = AutomationRepository.get(context)
                AlarmScheduler.rescheduleAll(context, repository.getEnabled())
                AutomationEngine(context).dispatch(TriggerEvent.Boot)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
