package com.ryuk.desktophub.data

import android.content.Context
import android.util.DisplayMetrics
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

enum class DesktopEnvironment(
    val label: String,
    val description: String,
    /** Pacchetti Termux da installare. */
    val packages: String,
    /** Eseguibile la cui presenza indica che l'ambiente è installato. */
    val binary: String,
    val startCommand: String,
    /** Nome esatto del processo principale (per `pgrep -x`/`pkill -x`). */
    val processName: String,
) {
    XFCE(
        "XFCE (completo)",
        "Barra delle applicazioni, menu Start, desktop e file manager: come un PC. ≈ 400 MB.",
        "xfce4 xfce4-terminal",
        "xfce4-session",
        "dbus-launch --exit-with-session xfce4-session",
        "xfce4-session",
    ),
    FLUXBOX(
        "Fluxbox (leggero)",
        "Gestore finestre minimale con barra e menu (tasto destro sul desktop). " +
            "Ideale per telefoni poco potenti. ≈ 20 MB.",
        "fluxbox xterm",
        "fluxbox",
        "fluxbox",
        "fluxbox",
    ),
}

enum class Resolution(val label: String, val width: Int) {
    LARGE("Grande (testo più leggibile)", 1024),
    MEDIUM("Media (consigliata)", 1280),
    SMALL("Piccola (più spazio)", 1600),
    HD("Full HD", 1920),
}

enum class InputMode(val label: String) {
    TOUCH("Tocco diretto"),
    TOUCHPAD("Touchpad"),
}

/** Preferenze dell'app (SharedPreferences). */
class Settings(context: Context) {

    private val prefs = context.getSharedPreferences("desktop_hub", Context.MODE_PRIVATE)
    private val metrics: DisplayMetrics = context.resources.displayMetrics

    /** Password VNC casuale generata al primo avvio (il server ascolta solo in locale). */
    val vncPassword: String
        get() = prefs.getString(KEY_PASSWORD, null) ?: generatePassword().also {
            prefs.edit().putString(KEY_PASSWORD, it).apply()
        }

    var environment: DesktopEnvironment
        get() = enumValueOrDefault(prefs.getString(KEY_ENV, null), DesktopEnvironment.XFCE)
        set(value) = prefs.edit().putString(KEY_ENV, value.name).apply()

    var resolution: Resolution
        get() = enumValueOrDefault(prefs.getString(KEY_RES, null), Resolution.MEDIUM)
        set(value) = prefs.edit().putString(KEY_RES, value.name).apply()

    var inputMode: InputMode
        get() = enumValueOrDefault(prefs.getString(KEY_INPUT, null), InputMode.TOUCH)
        set(value) = prefs.edit().putString(KEY_INPUT, value.name).apply()

    /** Ultimo elenco noto di app installate (mostrato subito, poi aggiornato da Termux). */
    var installedCache: Set<String>
        get() = prefs.getStringSet(KEY_INSTALLED, emptySet()) ?: emptySet()
        set(value) = prefs.edit().putStringSet(KEY_INSTALLED, value).apply()

    /** Dimensione del desktop in pixel: larghezza scelta, altezza con le proporzioni dello schermo. */
    fun desktopSize(): Pair<Int, Int> {
        val long = max(metrics.widthPixels, metrics.heightPixels).toFloat()
        val short = min(metrics.widthPixels, metrics.heightPixels).toFloat()
        val w = resolution.width
        var h = (w * short / long).roundToInt()
        if (h % 2 != 0) h += 1
        return w to h.coerceAtLeast(480)
    }

    val customApps: List<DesktopApp>
        get() {
            val raw = prefs.getString(KEY_CUSTOM, null) ?: return emptyList()
            return runCatching {
                val arr = JSONArray(raw)
                (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    AppCatalog.customApp(
                        id = o.getString("id"),
                        name = o.getString("name"),
                        packages = o.getString("packages"),
                        launch = o.getString("launch"),
                    )
                }
            }.getOrDefault(emptyList())
        }

    fun addCustomApp(name: String, packages: String, launch: String) {
        val arr = JSONArray(prefs.getString(KEY_CUSTOM, null) ?: "[]")
        arr.put(
            JSONObject()
                .put("id", "custom-" + System.currentTimeMillis())
                .put("name", name)
                .put("packages", packages)
                .put("launch", launch)
        )
        prefs.edit().putString(KEY_CUSTOM, arr.toString()).apply()
    }

    fun removeCustomApp(id: String) {
        val arr = JSONArray(prefs.getString(KEY_CUSTOM, null) ?: "[]")
        val out = JSONArray()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            if (o.getString("id") != id) out.put(o)
        }
        prefs.edit().putString(KEY_CUSTOM, out.toString()).apply()
    }

    private fun generatePassword(): String {
        val chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val rnd = SecureRandom()
        // VNC usa solo i primi 8 caratteri della password.
        return (1..8).map { chars[rnd.nextInt(chars.length)] }.joinToString("")
    }

    private inline fun <reified T : Enum<T>> enumValueOrDefault(name: String?, default: T): T =
        name?.let { n -> enumValues<T>().firstOrNull { it.name == n } } ?: default

    companion object {
        private const val KEY_PASSWORD = "vnc_password"
        private const val KEY_ENV = "environment"
        private const val KEY_RES = "resolution"
        private const val KEY_INPUT = "input_mode"
        private const val KEY_INSTALLED = "installed"
        private const val KEY_CUSTOM = "custom_apps"
    }
}
