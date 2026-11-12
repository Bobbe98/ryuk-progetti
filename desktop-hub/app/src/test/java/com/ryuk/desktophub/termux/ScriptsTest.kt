package com.ryuk.desktophub.termux

import com.ryuk.desktophub.data.AppCatalog
import com.ryuk.desktophub.data.DesktopEnvironment
import org.junit.Assert.assertEquals
import org.junit.Assume
import org.junit.Test
import java.io.File

/** Controlla con `bash -n` che tutti gli script generati siano sintatticamente validi. */
class ScriptsTest {

    private fun allScripts(): Map<String, String> {
        val apps = AppCatalog.builtIn + AppCatalog.customApp("custom-1", "Prova 'x'", "xpdf, xterm", "xpdf") +
            AppCatalog.windowsProgram("/home/u/.wine/drive_c/users/u/Desktop/L'App \"Pro\" (x86).lnk")
        val out = linkedMapOf<String, String>()
        DesktopEnvironment.entries.forEach {
            out["setup-${it.name}"] = Scripts.setup(it)
            out["start-${it.name}"] = Scripts.startDesktop(it, 1280, 592, "pa'ss\"w")
        }
        apps.forEach {
            out["install-${it.id}"] = Scripts.installApp(it)
            out["uninstall-${it.id}"] = Scripts.uninstallApp(it)
            out["launch-${it.id}"] = Scripts.launchApp(it)
        }
        out["status"] = Scripts.status(apps)
        out["stop"] = Scripts.stopDesktop()
        out["enable"] = Scripts.ENABLE_EXTERNAL_APPS
        out["storage"] = Scripts.storageSetup
        out["diagnostics"] = Scripts.diagnostics
        out["open-exe"] = Scripts.openFile("Download/DesktopHub/scelta-1/Setup Gioco (1).EXE")
        out["open-msi"] = Scripts.openFile("Download/DesktopHub/app.msi")
        out["open-txt"] = Scripts.openFile("Download/DesktopHub/l'elenco \"spesa\".txt")
        return out
    }

    @Test
    fun scriptsHaveValidBashSyntax() {
        Assume.assumeTrue(File("/bin/bash").exists())
        val scripts = allScripts()
        for ((name, script) in scripts) {
            val p = ProcessBuilder("/bin/bash", "-n", "-c", script).redirectErrorStream(true).start()
            val output = p.inputStream.bufferedReader().readText()
            assertEquals("Script '$name' non valido:\n$output\n---\n$script", 0, p.waitFor())
        }
        System.getenv("SCRIPTS_OUT")?.let { dir ->
            scripts.forEach { (n, s) -> File(dir, "$n.sh").writeText(s) }
        }
    }

    @Test
    fun quoteEscapesSingleQuotes() {
        assertEquals("'it'\\''s'", Shell.quote("it's"))
    }
}
