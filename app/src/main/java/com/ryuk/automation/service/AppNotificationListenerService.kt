package com.ryuk.automation.service

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.ryuk.automation.data.model.TriggerEvent
import com.ryuk.automation.engine.AutomationEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Feeds [com.ryuk.automation.data.model.Trigger.NotificationPosted] triggers. */
class AppNotificationListenerService : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var engine: AutomationEngine

    override fun onListenerConnected() {
        super.onListenerConnected()
        engine = AutomationEngine(applicationContext)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName == packageName) return // ignore our own notifications
        val extras = sbn.notification.extras
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        scope.launch {
            engine.dispatch(TriggerEvent.Notification(sbn.packageName, "$title $text".trim()))
        }
    }
}
