package com.ryuk.desktophub.data

import com.ryuk.desktophub.termux.Shell

enum class Category(val label: String) {
    INTERNET("Internet"),
    OFFICE("Ufficio"),
    GRAPHICS("Grafica"),
    DEV("Sviluppo"),
    MEDIA("Multimedia"),
    UTILITY("Utilità"),
    WINDOWS("Windows"),
    CUSTOM("Mie app"),
}

/**
 * Un'app per computer installabile.
 *
 * @param install corpo dello script (bash) che la installa, eseguito nel terminale Termux
 * @param check espressione bash vera se l'app è installata
 * @param launch comando che la avvia sul display X `:1`
 * @param uninstall corpo dello script che la rimuove
 */
data class DesktopApp(
    val id: String,
    val name: String,
    val description: String,
    val category: Category,
    val install: String,
    val check: String,
    val launch: String,
    val uninstall: String,
    val size: String = "",
    val experimental: Boolean = false,
    val custom: Boolean = false,
    /** Spazio libero minimo (MB) controllato prima di installare: messaggio chiaro invece di un errore a metà. */
    val minFreeMb: Int = 0,
    /** Programma Windows installato dentro Wine (trovato dai suoi collegamenti .lnk). */
    val windowsProgram: Boolean = false,
)

object AppCatalog {

    /** App distribuita come pacchetto nativo di Termux (repository x11). */
    private fun termuxPkg(
        id: String,
        name: String,
        description: String,
        category: Category,
        packages: List<String>,
        launch: String,
        size: String,
        checkPackage: String = packages.first(),
        experimental: Boolean = false,
        minFreeMb: Int = 0,
    ) = DesktopApp(
        id = id,
        name = name,
        description = description,
        category = category,
        install = "inst ${packages.joinToString(" ")}",
        check = "dpkg -s ${Shell.quote(checkPackage)} >/dev/null 2>&1",
        launch = launch,
        uninstall = "apt-get remove -y ${packages.joinToString(" ")} && apt-get autoremove -y",
        size = size,
        experimental = experimental,
        minFreeMb = minFreeMb,
    )

    /** Prova di Wine: se anche il Blocco note è bianco il problema è generale, non del programma. */
    val wineNotepadTest = DesktopApp(
        id = "wine-notepad-test",
        name = "Blocco note di Wine",
        description = "Prova di Wine",
        category = Category.WINDOWS,
        install = "",
        check = "true",
        launch = "hangover-wine notepad",
        uninstall = "",
        windowsProgram = true,
    )

    /** Programma Windows installato, da un collegamento .lnk del menu Start o del desktop di Wine. */
    fun windowsProgram(lnkPath: String): DesktopApp = DesktopApp(
        id = "win-" + Integer.toHexString(lnkPath.hashCode()),
        name = lnkPath.substringAfterLast('/').removeSuffix(".lnk").removeSuffix(".LNK"),
        description = "Programma Windows installato (si apre con Wine).",
        category = Category.WINDOWS,
        install = "",
        check = "true",
        // /wait: così se il programma si chiude subito con un errore l'app lo segnala
        launch = "hangover-wine start /wait /unix ${Shell.quote(lnkPath)}",
        uninstall = "",
        windowsProgram = true,
    )

    /** Crea un'app personalizzata a partire da pacchetti Termux scelti dall'utente. */
    fun customApp(id: String, name: String, packages: String, launch: String): DesktopApp {
        val pkgs = packages.split(Regex("[\\s,]+")).filter { it.isNotBlank() }.map(Shell::quote)
        val first = pkgs.firstOrNull() ?: "''"
        return DesktopApp(
            id = id,
            name = name,
            description = "Pacchetti: ${packages.trim()}",
            category = Category.CUSTOM,
            install = "inst ${pkgs.joinToString(" ")}",
            check = "dpkg -s $first >/dev/null 2>&1",
            launch = launch,
            uninstall = "apt-get remove -y ${pkgs.joinToString(" ")}",
            custom = true,
        )
    }

    val builtIn: List<DesktopApp> = listOf(
        termuxPkg(
            "firefox", "Firefox",
            "Il browser web completo per computer, con estensioni e siti in versione desktop.",
            Category.INTERNET, listOf("firefox"), "firefox", "≈ 300 MB",
            minFreeMb = 700,
        ),
        termuxPkg(
            "libreoffice", "LibreOffice",
            "Suite per ufficio: Writer (documenti), Calc (fogli di calcolo), Impress " +
                "(presentazioni). Apre e salva file Word, Excel e PowerPoint.",
            Category.OFFICE, listOf("libreoffice"), "libreoffice", "≈ 125 MB da scaricare, 600 MB installato",
            minFreeMb = 1200,
        ),
        termuxPkg(
            "mousepad", "Mousepad",
            "Editor di testo semplice e veloce (stile Blocco note).",
            Category.OFFICE, listOf("mousepad"), "mousepad", "≈ 10 MB",
        ),
        termuxPkg(
            "gimp", "GIMP",
            "Fotoritocco ed editing di immagini avanzato (alternativa a Photoshop).",
            Category.GRAPHICS, listOf("gimp"), "gimp", "≈ 300 MB",
        ),
        termuxPkg(
            "inkscape", "Inkscape",
            "Grafica vettoriale: loghi, illustrazioni, SVG (alternativa a Illustrator).",
            Category.GRAPHICS, listOf("inkscape"), "inkscape", "≈ 200 MB",
        ),
        termuxPkg(
            "code-oss", "Code - OSS",
            "La versione open source di Visual Studio Code.",
            Category.DEV, listOf("code-oss"), "code-oss --no-sandbox", "≈ 350 MB",
            minFreeMb = 800,
        ),
        termuxPkg(
            "geany", "Geany",
            "IDE leggero per programmare in molti linguaggi.",
            Category.DEV, listOf("geany"), "geany", "≈ 30 MB",
        ),
        termuxPkg(
            "vlc", "VLC",
            "Lettore multimediale per quasi tutti i formati audio e video.",
            Category.MEDIA, listOf("vlc-qt"), "vlc", "≈ 150 MB",
        ),
        termuxPkg(
            "audacious", "Audacious",
            "Lettore musicale leggero.",
            Category.MEDIA, listOf("audacious"), "audacious", "≈ 30 MB",
        ),
        termuxPkg(
            "audacity", "Audacity",
            "Registrazione e montaggio audio.",
            Category.MEDIA, listOf("audacity"), "audacity", "≈ 80 MB",
        ),
        termuxPkg(
            "thunar", "Thunar",
            "File manager in stile Esplora risorse.",
            Category.UTILITY, listOf("thunar"), "thunar", "≈ 15 MB",
        ),
        termuxPkg(
            "terminal", "Terminale",
            "Terminale grafico per il desktop.",
            Category.UTILITY, listOf("xfce4-terminal"), "xfce4-terminal", "≈ 10 MB",
        ),
        termuxPkg(
            "galculator", "Calcolatrice",
            "Calcolatrice scientifica.",
            Category.UTILITY, listOf("galculator"), "galculator", "≈ 5 MB",
        ),
        DesktopApp(
            id = "wine",
            name = "Wine (programmi Windows .exe)",
            description = "Esegue programmi Windows semplici (.exe, .msi) tramite Hangover: Wine con " +
                "gli emulatori x86 Box64 e FEX. Per installare un programma usa \"Apri file dal " +
                "telefono\" e scegli il suo .exe. La memoria del telefono è l'unità D:. Solo " +
                "processori a 64 bit (ARM64); giochi e programmi pesanti in genere non funzionano.",
            category = Category.WINDOWS,
            install = """
                if [ "${'$'}(dpkg --print-architecture)" != "aarch64" ]; then
                  echo "Wine/Hangover esiste solo per Termux a 64 bit (aarch64)."
                  echo "Il tuo Termux è: ${'$'}(dpkg --print-architecture)"
                  false
                fi
                inst hangover
            """.trimIndent(),
            // il meta-pacchetto garantisce anche gli emulatori x86 (Box64/FEX)
            check = "dpkg -s hangover >/dev/null 2>&1 && command -v hangover-wine >/dev/null 2>&1",
            launch = "hangover-wine explorer",
            uninstall = "apt-get remove -y hangover hangover-wine hangover-wowbox64 " +
                "hangover-libwow64fex hangover-libarm64ecfex && apt-get autoremove -y",
            size = "≈ 270 MB da scaricare, 2,4 GB installato",
            experimental = true,
            minFreeMb = 3500,
        ),
    )
}
