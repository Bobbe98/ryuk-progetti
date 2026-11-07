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
)

object AppCatalog {

    private const val DEBIAN_ROOT = "\$PREFIX/var/lib/proot-distro/installed-rootfs/debian"

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
            Category.INTERNET, listOf("firefox"), "firefox", "≈ 250 MB",
        ),
        termuxPkg(
            "hexchat", "HexChat",
            "Client di chat IRC.",
            Category.INTERNET, listOf("hexchat"), "hexchat", "≈ 20 MB",
        ),
        DesktopApp(
            id = "libreoffice",
            name = "LibreOffice",
            description = "Suite per ufficio: Writer (documenti), Calc (fogli di calcolo), Impress " +
                "(presentazioni). Apre e salva file Word, Excel e PowerPoint. Gira dentro un " +
                "Debian leggero (proot-distro).",
            category = Category.OFFICE,
            install = """
                inst proot-distro
                if [ ! -d "$DEBIAN_ROOT" ]; then proot-distro install debian; fi
                proot-distro login debian -- bash -c 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-gtk3 fonts-dejavu fonts-liberation'
            """.trimIndent(),
            check = "[ -x \"$DEBIAN_ROOT/usr/bin/libreoffice\" ]",
            launch = "proot-distro login debian --shared-tmp -- env DISPLAY=:1 libreoffice",
            uninstall = "proot-distro login debian -- bash -c 'apt-get remove -y \"libreoffice*\" && apt-get autoremove -y'",
            size = "≈ 1 GB",
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
            description = "Esegue programmi Windows semplici (.exe) tramite Hangover/Wine. " +
                "Si apre l'Esplora file di Wine: il telefono è in Z:\\ e la memoria interna in " +
                "Z:\\data\\data\\com.termux\\files\\home\\storage\\shared. Solo processori ARM64; " +
                "giochi e programmi pesanti in genere non funzionano.",
            category = Category.WINDOWS,
            install = "inst hangover-wine || inst hangover",
            check = "command -v wine >/dev/null 2>&1",
            launch = "wine explorer",
            uninstall = "apt-get remove -y 'hangover*' && apt-get autoremove -y",
            size = "≈ 500 MB",
            experimental = true,
        ),
    )
}
