package com.ryuk.desktophub

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Permessi indispensabili: senza INTERNET Android blocca anche i socket verso 127.0.0.1 (EPERM). */
class ManifestTest {

    private val manifest = listOf("src/main/AndroidManifest.xml", "app/src/main/AndroidManifest.xml")
        .map(::File).first { it.exists() }.readText()

    @Test
    fun declaresInternetPermission() {
        assertTrue(manifest.contains("\"android.permission.INTERNET\""))
    }

    @Test
    fun declaresTermuxRunCommandPermission() {
        assertTrue(manifest.contains("\"com.termux.permission.RUN_COMMAND\""))
    }
}
