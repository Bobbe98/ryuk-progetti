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

class ProgramFailureHintTest {
    private fun hint(log: String) =
        PhoneFileOpener.explainProgramFailure(PhoneFileOpener.Result.ProgramFailed("setup.exe", 53, log))

    @Test
    fun suggestsVisualCppRuntime() {
        org.junit.Assert.assertTrue(hint("0024:err:module:import_dll Library MSVCP140.dll not found").contains("Visual C++"))
    }

    @Test
    fun suggestsKeepingFilesTogether() {
        org.junit.Assert.assertTrue(hint("wine: could not load L\"C:\\\\x\\\\data.bin\"").contains("insieme"))
    }

    @Test
    fun androidKill() {
        org.junit.Assert.assertTrue(
            PhoneFileOpener.explainProgramFailure(PhoneFileOpener.Result.ProgramFailed("a.exe", 137, ""))
                .contains("Android ha chiuso")
        )
    }
}
