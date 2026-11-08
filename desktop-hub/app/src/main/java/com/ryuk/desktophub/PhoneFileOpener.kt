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

/**
 * Apre nel desktop un file scelto dal telefono (es. un installer .exe scaricato).
 *
 * Il selettore di Android restituisce un content:// che Termux non può leggere: il file
 * viene quindi copiato in `Download/DesktopHub/`, una cartella che Termux vede, e poi
 * aperto nel desktop (Wine per .exe/.msi, il programma predefinito per il resto).
 */
class PhoneFileOpener(private val context: Context) {

    sealed interface Result {
        data class Opened(val fileName: String) : Result
        /** Termux non ha ancora l'accesso ai file del telefono. */
        data object NeedsStorage : Result
        data object NeedsWine : Result
        data object NeedsWritePermission : Result
        data class Failed(val message: String) : Result
    }

    private val bridge = TermuxBridge(context)
    private val settings = Settings(context)

    fun needsLegacyWritePermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED

    suspend fun open(uri: Uri): Result {
        if (needsLegacyWritePermission()) return Result.NeedsWritePermission
        val name = try {
            withContext(Dispatchers.IO) { copyToDownloads(uri) }
        } catch (e: Exception) {
            return Result.Failed("Impossibile copiare il file: ${e.message}")
        }
        val (w, h) = settings.desktopSize()
        val script = Scripts.startDesktop(settings.environment, w, h, settings.vncPassword) + "\n" +
            Scripts.openFile("Download/$SUBDIR/$name")
        val r = runCatching { bridge.runBackground(script, timeoutMs = 30_000) }.getOrNull()
            ?: return Result.Failed("Termux non ha risposto. Apri Termux una volta e riprova.")
        return when {
            r.ok && r.stdout.contains("OPENED") -> Result.Opened(name)
            r.exitCode == Scripts.EXIT_NO_STORAGE -> Result.NeedsStorage
            r.exitCode == Scripts.EXIT_NEED_WINE -> Result.NeedsWine
            r.exitCode == Scripts.EXIT_NO_OPENER ->
                Result.Failed("Nel desktop non c'è un programma per aprire questo tipo di file.")
            else -> Result.Failed(r.describeError())
        }
    }

    /** Copia il file e restituisce il nome con cui è stato salvato. */
    private fun copyToDownloads(uri: Uri): String {
        val name = displayName(uri)
        val resolver = context.contentResolver
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val relativePath = "${Environment.DIRECTORY_DOWNLOADS}/$SUBDIR/"
            val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
            // una copia precedente con lo stesso nome (creata da noi) viene sostituita
            resolver.delete(
                collection,
                "${MediaStore.MediaColumns.RELATIVE_PATH}=? AND ${MediaStore.MediaColumns.DISPLAY_NAME}=?",
                arrayOf(relativePath, name),
            )
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val target = resolver.insert(collection, values) ?: error("cartella Download non disponibile")
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
            // Android può aver rinominato il file (es. "setup (1).exe")
            resolver.query(target, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) return c.getString(0)
            }
            return name
        } else {
            @Suppress("DEPRECATION")
            val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), SUBDIR)
            dir.mkdirs()
            val out = File(dir, name)
            resolver.openInputStream(uri).use { input ->
                out.outputStream().use { requireNotNull(input) { "file non leggibile" }.copyTo(it) }
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

        fun describe(result: Result): String = when (result) {
            is Result.Opened -> "Apertura di ${result.fileName} nel desktop…"
            Result.NeedsStorage ->
                "Termux non può ancora vedere i file del telefono: consenti l'accesso in Termux e riprova."
            Result.NeedsWine ->
                "Per aprire i programmi Windows installa prima \"Wine\" dalla scheda App."
            Result.NeedsWritePermission -> "Consenti l'accesso alla memoria e riprova."
            is Result.Failed -> result.message
        }
    }
}
