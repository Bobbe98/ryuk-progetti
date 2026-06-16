package com.ryuk.automation.service

import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import com.ryuk.automation.data.model.TriggerEvent
import com.ryuk.automation.engine.AutomationEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Detects foreground app changes (for [com.ryuk.automation.data.model.Trigger.AppLaunched])
 * and exposes global actions (e.g. lock screen) actions can trigger.
 */
class AppAccessibilityService : AccessibilityService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var engine: AutomationEngine
    private var lastPackageName: String? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        engine = AutomationEngine(applicationContext)
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val packageName = event.packageName?.toString() ?: return
        if (packageName == lastPackageName) return
        lastPackageName = packageName
        scope.launch { engine.dispatch(TriggerEvent.AppLaunch(packageName)) }
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    fun lockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
        }
    }

    companion object {
        var instance: AppAccessibilityService? = null
    }
}
