package com.ryuk.desktophub.termux

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Ponte verso Termux tramite l'API `RUN_COMMAND`.
 *
 * Termux fornisce un vero ambiente Linux (pacchetti `pkg`, X11, VNC, proot-distro)
 * senza root: Desktop Hub lo usa come "motore" per installare ed eseguire le app
 * per computer, che poi vengono mostrate nel visualizzatore VNC integrato.
 *
 * Requisiti lato Termux:
 *  - `allow-external-apps=true` in `~/.termux/termux.properties`
 *  - permesso `com.termux.permission.RUN_COMMAND` concesso a questa app
 */
class TermuxBridge(private val context: Context) {

    data class CommandResult(
        val stdout: String,
        val stderr: String,
        val exitCode: Int,
        /** Errore interno di Termux (es. app esterne non abilitate). -1 = nessuno. */
        val termuxError: Int,
        val termuxErrorMessage: String?,
    ) {
        val ok get() = exitCode == 0 && (termuxError == -1 || termuxError == 0)
        fun describeError(): String = when {
            !termuxErrorMessage.isNullOrBlank() -> termuxErrorMessage
            stderr.isNotBlank() -> stderr.trim().lines().takeLast(6).joinToString("\n")
            else -> "Comando terminato con codice $exitCode"
        }
    }

    fun isTermuxInstalled(): Boolean = try {
        context.packageManager.getPackageInfo(PACKAGE, 0)
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }

    fun hasRunCommandPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, PERMISSION) == PackageManager.PERMISSION_GRANTED

    /** Apre Termux (utile per i passaggi manuali di configurazione). */
    fun launchTermux(): Boolean {
        val intent = context.packageManager.getLaunchIntentForPackage(PACKAGE) ?: return false
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return true
    }

    /**
     * Esegue uno script in una nuova sessione visibile del terminale Termux: l'utente
     * vede l'avanzamento (download, installazione) e il risultato.
     */
    fun runInTerminal(script: String, label: String) {
        val intent = baseIntent(script).apply {
            putExtra(EXTRA_BACKGROUND, false)
            putExtra(EXTRA_SESSION_ACTION, "0") // nuova sessione e porta Termux in primo piano
            putExtra(EXTRA_COMMAND_LABEL, label)
        }
        start(intent)
    }

    /**
     * Esegue uno script in background e restituisce stdout/stderr/codice di uscita.
     * Restituisce null se Termux non risponde entro [timeoutMs].
     */
    suspend fun runBackground(script: String, timeoutMs: Long = 60_000): CommandResult? {
        val id = nextId.incrementAndGet()
        val deferred = CompletableDeferred<CommandResult>()
        pending[id] = deferred

        val resultIntent = Intent(context, TermuxResultReceiver::class.java).apply {
            putExtra(TermuxResultReceiver.EXTRA_REQUEST_ID, id)
        }
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        // Termux deve poter aggiungere il bundle del risultato: serve un PendingIntent mutabile.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags = flags or PendingIntent.FLAG_MUTABLE
        val pendingIntent = PendingIntent.getBroadcast(context, id, resultIntent, flags)

        val intent = baseIntent(script).apply {
            putExtra(EXTRA_BACKGROUND, true)
            putExtra(EXTRA_PENDING_INTENT, pendingIntent)
        }
        return try {
            start(intent)
            withTimeoutOrNull(timeoutMs) { deferred.await() }
        } finally {
            pending.remove(id)
        }
    }

    private fun baseIntent(script: String) = Intent(ACTION_RUN_COMMAND).apply {
        component = ComponentName(PACKAGE, SERVICE)
        putExtra(EXTRA_PATH, BASH)
        putExtra(EXTRA_ARGUMENTS, arrayOf("-l", "-c", script))
        putExtra(EXTRA_WORKDIR, HOME)
    }

    private fun start(intent: Intent) {
        try {
            context.startService(intent)
        } catch (e: IllegalStateException) {
            // App in background: su Android 8+ serve startForegroundService.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                throw e
            }
        }
    }

    companion object {
        const val PACKAGE = "com.termux"
        const val PERMISSION = "com.termux.permission.RUN_COMMAND"
        const val PREFIX = "/data/data/com.termux/files/usr"
        const val HOME = "/data/data/com.termux/files/home"
        private const val BASH = "$PREFIX/bin/bash"
        private const val SERVICE = "com.termux.app.RunCommandService"
        private const val ACTION_RUN_COMMAND = "com.termux.RUN_COMMAND"

        private const val EXTRA_PATH = "com.termux.RUN_COMMAND_PATH"
        private const val EXTRA_ARGUMENTS = "com.termux.RUN_COMMAND_ARGUMENTS"
        private const val EXTRA_WORKDIR = "com.termux.RUN_COMMAND_WORKDIR"
        private const val EXTRA_BACKGROUND = "com.termux.RUN_COMMAND_BACKGROUND"
        private const val EXTRA_SESSION_ACTION = "com.termux.RUN_COMMAND_SESSION_ACTION"
        private const val EXTRA_COMMAND_LABEL = "com.termux.RUN_COMMAND_COMMAND_LABEL"
        private const val EXTRA_PENDING_INTENT = "com.termux.RUN_COMMAND_PENDING_INTENT"

        const val FDROID_URL = "https://f-droid.org/packages/com.termux/"
        const val GITHUB_URL = "https://github.com/termux/termux-app/releases"

        private val nextId = AtomicInteger(1000)
        private val pending = ConcurrentHashMap<Int, CompletableDeferred<CommandResult>>()

        internal fun deliver(id: Int, result: CommandResult) {
            pending[id]?.complete(result)
        }
    }
}
