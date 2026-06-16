package com.ryuk.automation

import android.app.Application
import com.ryuk.automation.service.AutomationForegroundService

class RyukApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AutomationForegroundService.start(this)
    }
}
