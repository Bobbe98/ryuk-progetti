package com.ryuk.automation.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.ryuk.automation.MainActivity
import com.ryuk.automation.data.model.TriggerEvent
import com.ryuk.automation.data.repository.AutomationRepository
import com.ryuk.automation.engine.AlarmScheduler
import com.ryuk.automation.engine.AutomationEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

const val NOTIFICATION_CHANNEL_ACTIONS = "ryuk_actions"
private const val NOTIFICATION_CHANNEL_SERVICE = "ryuk_service"
private const val SERVICE_NOTIFICATION_ID = 1

/**
 * Foreground service that stays alive to listen for device-level events not deliverable
 * via manifest-registered receivers on modern Android (battery, power, screen, Wi-Fi).
 */
class AutomationForegroundService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var engine: AutomationEngine
    private var lastBatteryPercent = -1

    private val stateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_BATTERY_CHANGED -> {
                    val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                    val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                    if (level < 0 || scale <= 0) return
                    val percent = (level * 100) / scale
                    if (percent != lastBatteryPercent) {
                        lastBatteryPercent = percent
                        scope.launch { engine.dispatch(TriggerEvent.Battery(percent)) }
                    }
                }
                Intent.ACTION_POWER_CONNECTED -> scope.launch { engine.dispatch(TriggerEvent.Power(true)) }
                Intent.ACTION_POWER_DISCONNECTED -> scope.launch { engine.dispatch(TriggerEvent.Power(false)) }
                Intent.ACTION_SCREEN_ON -> scope.launch { engine.dispatch(TriggerEvent.Screen(true)) }
                Intent.ACTION_SCREEN_OFF -> scope.launch { engine.dispatch(TriggerEvent.Screen(false)) }
            }
        }
    }

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            scope.launch { engine.dispatch(TriggerEvent.Wifi(connected = true, ssid = null)) }
        }
        override fun onLost(network: Network) {
            scope.launch { engine.dispatch(TriggerEvent.Wifi(connected = false, ssid = null)) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        engine = AutomationEngine(applicationContext)
        startForeground(SERVICE_NOTIFICATION_ID, buildServiceNotification())
        registerStateReceiver()
        registerWifiCallback()
        rescheduleAlarms()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        runCatching { unregisterReceiver(stateReceiver) }
        runCatching {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            cm.unregisterNetworkCallback(networkCallback)
        }
    }

    private fun registerStateReceiver() {
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_BATTERY_CHANGED)
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_POWER_DISCONNECTED)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
        }
        registerReceiver(stateReceiver, filter)
    }

    private fun registerWifiCallback() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .build()
        runCatching { cm.registerNetworkCallback(request, networkCallback) }
    }

    private fun rescheduleAlarms() {
        scope.launch {
            val automations = AutomationRepository.get(applicationContext).getEnabled()
            AlarmScheduler.rescheduleAll(applicationContext, automations)
        }
    }

    private fun buildServiceNotification(): Notification {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(NOTIFICATION_CHANNEL_SERVICE, "Motore automazioni", NotificationManager.IMPORTANCE_MIN)
            )
            manager.createNotificationChannel(
                NotificationChannel(NOTIFICATION_CHANNEL_ACTIONS, "Notifiche automazioni", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
        val openAppIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_SERVICE)
            .setSmallIcon(android.R.drawable.ic_menu_manage)
            .setContentTitle("Ryuk Automation è attivo")
            .setContentText("In ascolto dei trigger per le tue automazioni")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setContentIntent(openAppIntent)
            .build()
    }

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, AutomationForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, AutomationForegroundService::class.java))
        }
    }
}
