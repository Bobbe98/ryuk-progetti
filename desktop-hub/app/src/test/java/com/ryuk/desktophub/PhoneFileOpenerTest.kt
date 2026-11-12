package com.ryuk.desktophub

import org.junit.Assert.assertEquals
import org.junit.Test

class PhoneFileOpenerTest {

    @Test
    fun prefersInstallerAmongWindowsFiles() {
        assertEquals("Setup.EXE", PhoneFileOpener.mainFile(listOf("data1.cab", "readme.txt", "Setup.EXE", "tool.exe")))
        assertEquals("prog.msi", PhoneFileOpener.mainFile(listOf("prog.cab", "helper.exe", "prog.msi")))
    }

    @Test
    fun fallsBackToFirstWindowsFileThenFirstFile() {
        assertEquals("gioco.exe", PhoneFileOpener.mainFile(listOf("dati.bin", "gioco.exe", "altro.exe")))
        assertEquals("foto.jpg", PhoneFileOpener.mainFile(listOf("foto.jpg", "note.txt")))
    }
}
