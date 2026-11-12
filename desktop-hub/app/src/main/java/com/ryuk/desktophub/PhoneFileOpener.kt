package com.ryuk.desktophub

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.core.content.ContextCompat
import com.ryuk.desktophub.data.Settings
import com.ryuk.desktophub.termux.Scripts
import com.ryuk.desktophub.termux.TermuxBridge
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Apre nel desktop uno o più file scelti dal telefono (es. l'installer .exe di un programma,
 * insieme ai file che gli servono accanto).
 *
 * Il selettore di Android restituisce dei content:// che Termux non può leggere: i file
 * vengono copiati in `Download/DesktopHub/<scelta>/`, una cartella che Termux vede, e poi
 * aperti nel desktop. I file Windows vengono eseguiti dal disco C: di Wine (vedi
 * [Scripts.openFile]).
 */
class PhoneFileOpener(private val context: Context) {

    sealed interface Result {
        data class Opened(
            val fileName: String,
            /** Prima apertura di Wine: la preparazione richiede alcuni minuti. */
            val firstWineRun: Boolean = false,
            /** Processi attivi quando sono tanti (Android 12+ può chiuderne alcuni), altrimenti null. */
            val manyProcesses: Int? = null,
        ) : Result
        /** Termux non ha ancora l'accesso ai file del telefono. */
        data object NeedsStorage : Result
        data object NeedsWine : Result
        data object NeedsWritePermission : Result
        /** Il programma si è chiuso subito con un errore. */
        data class ProgramFailed(val fileName: String, val code: Int?, val log: String) : Result
        data class Failed(val message: String) : Result
    }

    private val bridge = TermuxBridge(context)
    private val settings = Settings(context)

    fun needsLegacyWritePermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED

    suspend fun open(uris: List<Uri>): Result {
        if (uris.isEmpty()) return Result.Failed("Nessun file scelto.")
        if (needsLegacyWritePermission()) return Result.NeedsWritePermission
        // ogni scelta in una cartella sua: i file di un installer restano insieme
        val batch = "scelta-" + SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(Date())
        val names = try {
            withContext(Dispatchers.IO) { uris.map { copyToDownloads(it, batch) } }
        } catch (e: Exception) {
            return Result.Failed("Impossibile copiare il file: ${e.message}")
        }
        val main = mainFile(names)
        val (w, h) = settings.desktopSize()
        val script = Scripts.startDesktop(settings.environment, w, h, settings.vncPassword) + "\n" +
            Scripts.openFile("Download/$SUBDIR/$batch/$main")
        val r = runCatching { bridge.runBackground(script, timeoutMs = 60_000) }.getOrNull()
            ?: return Result.Failed("Termux non ha risposto. Apri Termux una volta e riprova.")
        return when {
            r.ok && r.stdout.contains("OPENED") -> Result.Opened(
                fileName = main,
                firstWineRun = "FIRST_WINE_RUN" in r.stdout,
                manyProcesses = Regex("WARN_PROCESSES:(\\d+)").find(r.stdout)?.groupValues?.get(1)?.toIntOrNull(),
            )
            r.exitCode == Scripts.EXIT_APP_FAILED -> Result.ProgramFailed(
                fileName = main,
                code = Regex("APP_FAILED:(\\d+)").find(r.stdout)?.groupValues?.get(1)?.toIntOrNull(),
                log = r.stderr.trim(),
            )
            r.exitCode == Scripts.EXIT_NO_STORAGE -> Result.NeedsStorage
            r.exitCode == Scripts.EXIT_NEED_WINE -> Result.NeedsWine
            r.exitCode == Scripts.EXIT_NO_OPENER ->
                Result.Failed("Nel desktop non c'è un programma per aprire questo tipo di file.")
            else -> Result.Failed(r.describeError())
        }
    }

    /** Copia un file nella cartella della scelta e restituisce il nome con cui è stato salvato. */
    private fun copyToDownloads(uri: Uri, batch: String): String {
        val name = displayName(uri)
        val resolver = context.contentResolver
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/$SUBDIR/$batch/")
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val target = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: error("cartella Download non disponibile")
            try {
                resolver.openInputStream(uri).use { input ->
                    resolver.openOutputStream(target).use { output ->
                        requireNotNull(input) { "file non leggibile" }.copyTo(requireNotNull(output))
                    }
                }
            } catch (e: Exception) {
                resolver.delete(target, null, null)
                throw e
            }
            resolver.update(target, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
            // Android può aver rinominato il file (es. due file con lo stesso nome)
            resolver.query(target, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) return c.getString(0)
            }
            return name
        } else {
            @Suppress("DEPRECATION")
            val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "$SUBDIR/$batch")
            dir.mkdirs()
            resolver.openInputStream(uri).use { input ->
                File(dir, name).outputStream().use { requireNotNull(input) { "file non leggibile" }.copyTo(it) }
            }
            return name
        }
    }

    private fun displayName(uri: Uri): String {
        val raw = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
            ?: uri.lastPathSegment?.substringAfterLast('/')
            ?: "file"
        return raw.replace('/', '_').replace('\u0000', '_').trim().ifEmpty { "file" }
    }

    companion object {
        const val SUBDIR = "DesktopHub"

        /**
         * Quale file aprire tra quelli scelti: prima un programma Windows (preferendo i nomi
         * tipici degli installer), altrimenti il primo file.
         */
        fun mainFile(names: List<String>): String {
            val windows = names.filter { n -> listOf(".exe", ".msi", ".bat").any { n.lowercase().endsWith(it) } }
            if (windows.isEmpty()) return names.first()
            return windows.firstOrNull { n ->
                val l = n.lowercase()
                l.startsWith("setup") || l.startsWith("install") || l.endsWith(".msi")
            } ?: windows.first()
        }

        fun describe(result: Result): String = when (result) {
            is Result.Opened -> buildString {
                append("Apertura di ${result.fileName} nel desktop…")
                if (result.firstWineRun) {
                    append(" Prima volta con Wine: la preparazione richiede 1-3 minuti, attendi.")
                }
                result.manyProcesses?.let {
                    append(
                        " Attenzione: ci sono già $it processi attivi e Android può chiuderne " +
                            "alcuni. Se il programma sparisce, usa il desktop Fluxbox (Impostazioni) " +
                            "o disattiva le restrizioni dei processi secondari (scheda Inizia, Consigli)."
                    )
                }
            }
            Result.NeedsStorage ->
                "Termux non può ancora vedere i file del telefono: consenti l'accesso in Termux e riprova."
            Result.NeedsWine ->
                "Per aprire i programmi Windows installa prima \"Wine\" dalla scheda App."
            Result.NeedsWritePermission -> "Consenti l'accesso alla memoria e riprova."
            is Result.ProgramFailed -> explainProgramFailure(result)
            is Result.Failed -> result.message
        }

        private fun explainProgramFailure(r: Result.ProgramFailed): String {
            val log = r.log.lines().filter { it.isNotBlank() }.takeLast(5).joinToString("\n")
            val hint = when {
                r.code == 137 ->
                    "Android ha chiuso Wine (troppi processi). Usa il desktop Fluxbox o disattiva " +
                        "le restrizioni dei processi secondari (scheda Inizia, Consigli)."
                log.contains("Bad EXE format", ignoreCase = true) ||
                    log.contains("not a valid", ignoreCase = true) ->
                    "Il file non è un programma Windows valido o è danneggiato: riscaricalo."
                log.contains("could not load", ignoreCase = true) ||
                    log.contains("not found", ignoreCase = true) ->
                    "Mancano dei file: se il programma ne ha altri accanto (.cab, .bin, .dll, " +
                        "cartelle), sceglili tutti insieme con \"Apri file dal telefono\"."
                else -> "Alcuni programmi Windows non funzionano con Wine sul telefono."
            }
            return "${r.fileName} si è chiuso subito (codice ${r.code ?: "?"}). $hint" +
                if (log.isNotEmpty()) "\n$log" else ""
        }
    }
}
