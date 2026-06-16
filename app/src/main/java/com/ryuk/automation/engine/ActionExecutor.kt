package com.ryuk.automation.engine

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.telephony.SmsManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.ryuk.automation.data.model.Action
import com.ryuk.automation.data.model.RingerMode
import com.ryuk.automation.service.AppAccessibilityService
import com.ryuk.automation.service.NOTIFICATION_CHANNEL_ACTIONS
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine

private const val TAG = "ActionExecutor"

class ActionExecutor(private val context: Context) {

    private var tts: TextToSpeech? = null

    suspend fun executeAll(actions: List<Action>) {
        for (action in actions) {
            runCatching { execute(action) }
                .onFailure { Log.w(TAG, "Action failed: $action", it) }
        }
    }

    private suspend fun execute(action: Action) {
        when (action) {
            is Action.ShowToast -> showToast(action.text)
            is Action.ShowNotification -> showNotification(action.title, action.text)
            is Action.OpenApp -> openApp(action.packageName)
            is Action.OpenUrl -> openUrl(action.url)
            is Action.SetRingerMode -> setRingerMode(action.mode)
            is Action.SetMediaVolume -> setMediaVolume(action.percent)
            is Action.ToggleWifi -> toggleWifi(action.enable)
            is Action.ToggleBluetooth -> toggleBluetooth(action.enable)
            is Action.Vibrate -> vibrate(action.durationMs)
            is Action.SpeakText -> speak(action.text)
            is Action.SendSms -> sendSms(action.number, action.text)
            is Action.Delay -> delay(action.durationMs)
            is Action.LockScreen -> lockScreen()
            is Action.ToggleAirplaneModePanel -> openAirplaneModeSettings()
        }
    }

    private fun showToast(text: String) {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            android.widget.Toast.makeText(context, text, android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    private fun showNotification(title: String, text: String) {
        val manager = NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ACTIONS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .build()
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(System.currentTimeMillis().toInt(), manager)
    }

    private fun openApp(packageName: String) {
        val intent = context.packageManager.getLaunchIntentForPackage(packageName) ?: return
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    private fun openUrl(url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    private fun setRingerMode(mode: RingerMode) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        // SILENT/VIBRATE require Do Not Disturb access on API 24+.
        if (mode != RingerMode.NORMAL && !nm.isNotificationPolicyAccessGranted) {
            Log.w(TAG, "Missing Do Not Disturb access, cannot change ringer mode")
            return
        }
        audioManager.ringerMode = when (mode) {
            RingerMode.NORMAL -> AudioManager.RINGER_MODE_NORMAL
            RingerMode.VIBRATE -> AudioManager.RINGER_MODE_VIBRATE
            RingerMode.SILENT -> AudioManager.RINGER_MODE_SILENT
        }
    }

    private fun setMediaVolume(percent: Int) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val target = (max * (percent.coerceIn(0, 100) / 100f)).toInt()
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
    }

    /** Direct toggling is blocked by the platform since Android 10; open the quick-settings panel instead. */
    private fun toggleWifi(enable: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val intent = Intent(Settings.Panel.ACTION_WIFI).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } else {
            @Suppress("DEPRECATION")
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as android.net.wifi.WifiManager
            @Suppress("DEPRECATION")
            wifiManager.isWifiEnabled = enable
        }
    }

    /** Direct toggling needs BLUETOOTH_CONNECT at runtime on API 31+; fall back to system settings. */
    private fun toggleBluetooth(enable: Boolean) {
        val adapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter()
        if (adapter == null) return
        val hasPermission = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(context, android.Manifest.permission.BLUETOOTH_CONNECT) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!hasPermission) {
            context.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        }
        @Suppress("MissingPermission")
        if (enable) adapter.enable() else adapter.disable()
    }

    private fun vibrate(durationMs: Long) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        vibrator.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    private suspend fun speak(text: String) {
        val engine = ensureTts() ?: return
        engine.speak(text, TextToSpeech.QUEUE_ADD, null, text.hashCode().toString())
    }

    private suspend fun ensureTts(): TextToSpeech? {
        tts?.let { return it }
        return suspendCancellableCoroutine { cont ->
            val instance = arrayOfNulls<TextToSpeech>(1)
            instance[0] = TextToSpeech(context) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    tts = instance[0]
                    cont.resume(instance[0]) {}
                } else {
                    cont.resume(null) {}
                }
            }
        }
    }

    private fun sendSms(number: String, text: String) {
        if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.SEND_SMS) !=
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "Missing SEND_SMS permission")
            return
        }
        val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(SmsManager::class.java)
        } else {
            @Suppress("DEPRECATION")
            SmsManager.getDefault()
        }
        smsManager.sendTextMessage(number, null, text, null, null)
    }

    private fun lockScreen() {
        AppAccessibilityService.instance?.lockScreen()
            ?: Log.w(TAG, "Accessibility service not enabled, cannot lock screen")
    }

    private fun openAirplaneModeSettings() {
        context.startActivity(Intent(Settings.ACTION_AIRPLANE_MODE_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
