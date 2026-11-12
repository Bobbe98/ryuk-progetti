package com.ryuk.desktophub.termux

import com.ryuk.desktophub.data.DesktopApp
import com.ryuk.desktophub.data.DesktopEnvironment

object Shell {
    /** Quota una stringa per bash con apici singoli. */
    fun quote(s: String): String = "'" + s.replace("'", "'\\''") + "'"
}

/**
 * Script bash eseguiti dentro Termux.
 *
 * Il desktop gira su un server X virtuale (TigerVNC `Xvnc`) sul display `:1`, in ascolto
 * solo su 127.0.0.1 e protetto da password: il visualizzatore integrato dell'app vi si
 * collega in locale.
 */
object Scripts {

    const val DISPLAY_NUM = 1
    const val VNC_PORT = 5900 + DISPLAY_NUM
    private const val STATE_DIR = "\$HOME/.desktophub"

    /** Funzioni comuni: installazione non interattiva e repository x11 attivo. */
    private val COMMON = """
        export DEBIAN_FRONTEND=noninteractive
        APT_OPTS="-o Acquire::Retries=5 -o Dpkg::Options::=--force-confnew -o Dpkg::Options::=--force-confdef"
        inst() { apt-get install -y ${'$'}APT_OPTS "${'$'}@"; }
        # un'installazione interrotta (schermo spento, rete persa) blocca tutte le successive: si ripara
        repair_dpkg() {
          dpkg --configure -a || true
          apt-get install -f -y ${'$'}APT_OPTS || true
        }
        need_space_mb() {
          local free_mb
          free_mb=${'$'}(( ${'$'}(df -Pk "${'$'}PREFIX" | awk 'NR==2 {print ${'$'}4}') / 1024 ))
          if [ "${'$'}free_mb" -lt "${'$'}1" ]; then
            echo "Spazio insufficiente: servono almeno ${'$'}1 MB liberi, ce ne sono ${'$'}free_mb."
            echo "Libera spazio sul telefono e riprova."
            return 1
          fi
        }
        ensure_x11_repo() {
          if ! dpkg -s x11-repo >/dev/null 2>&1; then
            apt-get update && inst x11-repo
          fi
          apt-get update
        }
    """.trimIndent()

    /** Rilascia il wake lock preso per l'installazione, ma non se il desktop è in uso. */
    private const val RELEASE_WAKE_LOCK_IF_IDLE =
        "pgrep -x Xvnc >/dev/null 2>&1 || termux-wake-unlock >/dev/null 2>&1 || true"

    private fun terminalWrapper(title: String, body: String, done: String) = listOf(
        "set -e",
        // tiene sveglio Termux durante download lunghi (anche a schermo spento)
        "command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock >/dev/null 2>&1 || true",
        "trap 'echo; echo \"[X] Operazione non riuscita: controlla i messaggi qui sopra.\"; " +
            "echo \"    Puoi riprovare da Desktop Hub.\"; $RELEASE_WAKE_LOCK_IF_IDLE' ERR",
        COMMON,
        "echo \"==================================================\"",
        "echo \" Desktop Hub - $title\"",
        "echo \"==================================================\"",
        body,
        "echo",
        "echo \"[OK] $done\"",
        "echo \"Torna su Desktop Hub e premi Aggiorna.\"",
        RELEASE_WAKE_LOCK_IF_IDLE,
    ).joinToString("\n")

    /** Prima configurazione: server X/VNC e ambiente desktop. */
    fun setup(env: DesktopEnvironment): String = terminalWrapper(
        title = "preparazione ambiente desktop",
        body = """
            repair_dpkg
            apt-get update
            apt-get -y ${'$'}APT_OPTS full-upgrade
            ensure_x11_repo
            inst tigervnc procps dbus xdg-utils ${env.packages}
            mkdir -p "$STATE_DIR" ~/.vnc
            date > "$STATE_DIR/ready"
        """.trimIndent(),
        done = "Ambiente desktop pronto.",
    )

    fun installApp(app: DesktopApp): String = terminalWrapper(
        title = "installazione di ${app.name.replace("\"", "")}",
        body = listOfNotNull(
            "repair_dpkg",
            "ensure_x11_repo",
            if (app.minFreeMb > 0) "need_space_mb ${app.minFreeMb}" else null,
            app.install,
        ).joinToString("\n"),
        done = "${app.name.replace("\"", "")} installato.",
    )

    fun uninstallApp(app: DesktopApp): String = terminalWrapper(
        title = "rimozione di ${app.name.replace("\"", "")}",
        body = app.uninstall,
        done = "${app.name.replace("\"", "")} rimosso.",
    )

    /** Verifica in background quali app sono installate e lo stato del desktop. */
    fun status(apps: List<DesktopApp>): String = buildString {
        appendLine("command -v Xvnc >/dev/null 2>&1 && echo XVNC_OK")
        appendLine("ls \"\$HOME/storage/shared/\" >/dev/null 2>&1 && echo STORAGE_OK")
        appendLine("pgrep -x Xvnc >/dev/null 2>&1 && [ -S \"\$PREFIX/tmp/.X11-unix/X$DISPLAY_NUM\" ] && echo DESKTOP_RUNNING")
        for (env in DesktopEnvironment.entries) {
            appendLine("command -v ${env.binary} >/dev/null 2>&1 && echo ENV:${env.name}")
        }
        for (app in apps.filterNot { it.windowsProgram }) {
            appendLine("if ${app.check}; then echo ${Shell.quote("APP:" + app.id)}; fi")
        }
        appendLine(WINDOWS_PROGRAMS)
        appendLine("echo DONE")
    }

    /**
     * Avvia (se non già attivo) il server X virtuale e l'ambiente desktop.
     * Idempotente: si può chiamare prima di ogni avvio di app.
     */
    fun startDesktop(env: DesktopEnvironment, width: Int, height: Int, password: String): String = """
        export DISPLAY=:$DISPLAY_NUM
        mkdir -p "$STATE_DIR" ~/.vnc
        if ! command -v Xvnc >/dev/null 2>&1; then echo "Xvnc non trovato: completa la configurazione." >&2; exit 3; fi
        # Senza wake lock, finito questo script Termux chiude il suo servizio e Android
        # "congela" tutti i suoi processi (desktop compreso): il visualizzatore resterebbe bloccato.
        command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock >/dev/null 2>&1
        # la password viene riscritta sempre: Xvnc rilegge il file a ogni connessione
        printf '%s\n' ${Shell.quote(password)} | vncpasswd -f > ~/.vnc/passwd
        chmod 600 ~/.vnc/passwd
        X_SOCKET="${'$'}PREFIX/tmp/.X11-unix/X$DISPLAY_NUM"
        if ! { pgrep -x Xvnc >/dev/null 2>&1 && [ -S "${'$'}X_SOCKET" ]; }; then
          # nessun server valido: ripulisce eventuali resti e lo avvia
          pkill -x Xvnc 2>/dev/null
          rm -f "${'$'}PREFIX/tmp/.X$DISPLAY_NUM-lock" "${'$'}X_SOCKET"
          setsid nohup Xvnc :$DISPLAY_NUM -geometry ${width}x$height -depth 24 -localhost \
            -rfbport $VNC_PORT -rfbauth ~/.vnc/passwd -AlwaysShared -ac \
            > "$STATE_DIR/xvnc.log" 2>&1 < /dev/null &
          for i in $(seq 1 50); do
            [ -S "${'$'}X_SOCKET" ] && break
            sleep 0.2
          done
          if [ ! -S "${'$'}X_SOCKET" ]; then
            echo "Il server grafico non si è avviato:" >&2
            tail -n 5 "$STATE_DIR/xvnc.log" >&2
            exit 4
          fi
        fi
        $PHONE_LINKS
        # -x confronta il nome esatto del processo (con -f lo script troverebbe se stesso)
        if ! pgrep -x ${env.processName} >/dev/null 2>&1; then
          if command -v ${env.binary} >/dev/null 2>&1; then
            setsid nohup ${env.startCommand} > "$STATE_DIR/session.log" 2>&1 < /dev/null &
          fi
        fi
        echo STARTED
    """.trimIndent()

    /**
     * Elenca (`WINLNK:<percorso>`) i collegamenti dei programmi Windows installati: menu Start
     * comune e dell'utente, desktop di Wine. Esclusi disinstallatori, guide e siti web.
     * `find -H` segue i link solo alle cartelle di partenza: il desktop di Wine può puntare a
     * ~/Desktop, che a sua volta contiene il link "Telefono" da non esplorare.
     */
    private val WINDOWS_PROGRAMS = """
        C="${'$'}HOME/.wine/drive_c"
        if [ -d "${'$'}C" ]; then
          {
            find -H "${'$'}C/ProgramData/Microsoft/Windows/Start Menu/Programs" \
              "${'$'}C"/users/*/"AppData/Roaming/Microsoft/Windows/Start Menu/Programs" \
              -iname '*.lnk' 2>/dev/null
            find -H "${'$'}C"/users/*/Desktop -maxdepth 1 -iname '*.lnk' 2>/dev/null
          } | grep -viE '(uninst|disinstall|readme|leggimi|help|guida|manual|website|sito web|license|licenza)' \
            | sort -u | head -n 60 | sed 's/^/WINLNK:/'
        fi
    """.trimIndent()

    /** Uscita di [launchApp] quando il programma si chiude subito con un errore. */
    const val EXIT_APP_FAILED = 8

    /**
     * Avvia un programma e controlla per qualche secondo che non si chiuda con un errore:
     * in quel caso stampa `APP_FAILED:<codice>` e le ultime righe del suo log (stderr).
     * Il codice 137 significa che Android ha chiuso il processo (SIGKILL).
     */
    fun launchApp(app: DesktopApp): String {
        val id = app.id.filter { it.isLetterOrDigit() || it == '-' }.ifEmpty { "app" }
        return """
        export DISPLAY=:$DISPLAY_NUM
        mkdir -p "$STATE_DIR"
        LOG="$STATE_DIR/app-$id.log"
        EXITF="$STATE_DIR/app-$id.exit"
        rm -f "${'$'}EXITF"
        ${if (app.launch.contains("wine")) "[ -f \"\$HOME/.wine/system.reg\" ] || echo FIRST_WINE_RUN\n$PROCESS_WARNING\n${wineCompat("hangover-wine")}" else ""}
        setsid nohup bash -c 'bash -lc "${'$'}1"; echo ${'$'}? > "${'$'}2"' _ ${Shell.quote(app.launch)} "${'$'}EXITF" \
          > "${'$'}LOG" 2>&1 < /dev/null &
        for i in $(seq 1 30); do [ -f "${'$'}EXITF" ] && break; sleep 0.2; done
        if [ -f "${'$'}EXITF" ]; then
          CODE="$(cat "${'$'}EXITF")"
          if [ "${'$'}CODE" != "0" ]; then
            echo "APP_FAILED:${'$'}CODE"
            tail -n 12 "${'$'}LOG" >&2
            exit $EXIT_APP_FAILED
          fi
        fi
        echo LAUNCHED
        """.trimIndent()
    }

    fun stopDesktop(): String = """
        for p in ${DesktopEnvironment.entries.joinToString(" ") { it.processName }}; do pkill -x "${'$'}p" 2>/dev/null; done
        pkill -x Xvnc 2>/dev/null
        for i in $(seq 1 20); do pgrep -x Xvnc >/dev/null 2>&1 || break; sleep 0.2; done
        pkill -9 -x Xvnc 2>/dev/null
        rm -f "${'$'}PREFIX/tmp/.X$DISPLAY_NUM-lock" "${'$'}PREFIX/tmp/.X11-unix/X$DISPLAY_NUM"
        command -v termux-wake-unlock >/dev/null 2>&1 && termux-wake-unlock >/dev/null 2>&1
        echo STOPPED
    """.trimIndent()

    /** Comando che l'utente incolla in Termux per abilitare le app esterne. */
    const val ENABLE_EXTERNAL_APPS =
        "mkdir -p ~/.termux && (grep -q '^allow-external-apps' ~/.termux/termux.properties 2>/dev/null " +
            "&& sed -i 's/^allow-external-apps.*/allow-external-apps=true/' ~/.termux/termux.properties " +
            "|| echo 'allow-external-apps=true' >> ~/.termux/termux.properties) && termux-reload-settings " +
            "&& echo 'Fatto! Torna su Desktop Hub.'"

    /**
     * Collegamenti ai file del telefono, visibili nel desktop: icone "Telefono" e "Download"
     * sulla scrivania, segnalibri nel file manager e unità D: per Wine.
     */
    private val PHONE_LINKS = """
        if ls "${'$'}HOME/storage/shared/" >/dev/null 2>&1; then
          mkdir -p "${'$'}HOME/Desktop" "${'$'}HOME/.config/gtk-3.0"
          ln -sfn "${'$'}HOME/storage/shared" "${'$'}HOME/Desktop/Telefono"
          ln -sfn "${'$'}HOME/storage/shared/Download" "${'$'}HOME/Desktop/Download"
          BM="${'$'}HOME/.config/gtk-3.0/bookmarks"
          grep -q "storage/shared " "${'$'}BM" 2>/dev/null || echo "file://${'$'}HOME/storage/shared Telefono" >> "${'$'}BM"
          grep -q "storage/shared/Download " "${'$'}BM" 2>/dev/null || echo "file://${'$'}HOME/storage/shared/Download Download" >> "${'$'}BM"
          if [ -d "${'$'}HOME/.wine/dosdevices" ]; then ln -sfn "${'$'}HOME/storage/shared" "${'$'}HOME/.wine/dosdevices/d:"; fi
        fi
    """.trimIndent()

    /** Chiede a Termux l'accesso alla memoria del telefono e prepara i collegamenti nel desktop. */
    val storageSetup: String = terminalWrapper(
        title = "accesso ai file del telefono",
        body = """
            if ! ls "${'$'}HOME/storage/shared/" >/dev/null 2>&1; then
              echo "Android ti chiederà di consentire a Termux l'accesso ai file: tocca Consenti."
              termux-setup-storage
              for i in $(seq 1 120); do
                ls "${'$'}HOME/storage/shared/" >/dev/null 2>&1 && break
                sleep 1
              done
            fi
            if ! ls "${'$'}HOME/storage/shared/" >/dev/null 2>&1; then
              echo "Accesso ai file non concesso."
              false
            fi
            $PHONE_LINKS
        """.trimIndent(),
        done = "Ora sul desktop trovi le cartelle Telefono e Download.",
    )

    /**
     * Compatibilità grafica di Wine, applicata una volta sola per prefisso:
     * - WPF (.NET) in rendering software: senza, molti programmi mostrano una finestra bianca;
     * - OpenGL software (Mesa llvmpipe): sul desktop virtuale non c'è accelerazione 3D.
     * Si applica solo se il prefisso esiste già: crearlo richiede minuti e il comando
     * in background ha un tempo limite.
     */
    private const val WINE_COMPAT_VERSION = 1

    private fun wineCompat(wine: String): String = """
        export GALLIUM_DRIVER=llvmpipe
        COMPAT_MARK="$STATE_DIR/wine-compat-v$WINE_COMPAT_VERSION"
        if [ -f "${'$'}HOME/.wine/system.reg" ] && [ ! -f "${'$'}COMPAT_MARK" ]; then
          if timeout 45 $wine reg add 'HKCU\Software\Microsoft\Avalon.Graphics' \
               /v DisableHWAcceleration /t REG_DWORD /d 1 /f >> "$STATE_DIR/wine-compat.log" 2>&1; then
            date > "${'$'}COMPAT_MARK"
            echo WINE_COMPAT_APPLIED
          fi
        fi
    """.trimIndent()

    /**
     * Da Android 12 il sistema chiude i processi delle app oltre una soglia (32 in tutto).
     * Desktop completo + Wine la superano facilmente: si avvisa prima che succeda.
     */
    private val PROCESS_WARNING = """
        SDK_INT="$(getprop ro.build.version.sdk 2>/dev/null)"
        NPROC="$(ps -A -o pid= 2>/dev/null | wc -l)"
        if [ "${'$'}{SDK_INT:-0}" -ge 31 ] && [ "${'$'}{NPROC:-0}" -gt 22 ]; then echo "WARN_PROCESSES:${'$'}NPROC"; fi
    """.trimIndent()

    /**
     * Chiude tutti i programmi Windows, anche quelli bloccati: `wineserver -k` termina ogni
     * processo del prefisso; poi si eliminano gli eventuali superstiti cercandoli per nome
     * del processo (comm), mai con `pkill -f`, che troverebbe questo stesso script.
     */
    val killWindowsPrograms: String = """
        WS="${'$'}PREFIX/opt/hangover-wine/bin/wineserver"
        command -v wineserver >/dev/null 2>&1 && [ ! -x "${'$'}WS" ] && WS="$(command -v wineserver)"
        [ -x "${'$'}WS" ] && timeout 10 "${'$'}WS" -k 2>/dev/null
        sleep 1
        ps -A -o pid=,comm= 2>/dev/null | awk 'tolower(${'$'}2) ~ /\.exe${'$'}|^wineserver|^wine/ {print ${'$'}1}' | while read -r p; do
          kill -9 "${'$'}p" 2>/dev/null
        done
        echo "KILLED:$(ps -A -o comm= 2>/dev/null | grep -ciE '\.exe${'$'}|^wine')"
    """.trimIndent()

    /** Raccoglie le informazioni utili per capire perché un programma non funziona. */
    val diagnostics: String = """
        echo "== Sistema"
        echo "Android SDK: $(getprop ro.build.version.sdk 2>/dev/null)  modello: $(getprop ro.product.model 2>/dev/null)"
        echo "Architettura Termux: $(dpkg --print-architecture 2>/dev/null)"
        echo "Spazio libero: $(( $(df -Pk "${'$'}PREFIX" | awk 'NR==2 {print ${'$'}4}') / 1024 )) MB"
        echo "Processi attivi: $(ps -A -o pid= 2>/dev/null | wc -l)"
        echo "Desktop: $(pgrep -x Xvnc >/dev/null && echo attivo || echo spento)   Wine: $(command -v hangover-wine >/dev/null && echo installato || echo assente)"
        echo "Processi Wine: $(ps -A -o comm= 2>/dev/null | grep -ciE 'wine|\.exe')"
        echo
        for f in "${'$'}HOME/.desktophub/open-file.log" $(ls -t "${'$'}HOME"/.desktophub/app-*.log 2>/dev/null | head -n 2) "${'$'}HOME/.desktophub/wine-compat.log"; do
          [ -s "${'$'}f" ] || continue
          echo "== $(basename "${'$'}f") ($(date -r "${'$'}f" '+%d/%m %H:%M' 2>/dev/null))"
          grep -vE ':fixme:|^$' "${'$'}f" | tail -n 25
          echo
        done
        echo "== Processi Windows attivi"
        ps -A -o comm= 2>/dev/null | grep -iE '\.exe|wine' | sort | uniq -c | head -n 20
        echo
        echo "== Programmi Windows installati (tecnologia)"
        C="${'$'}HOME/.wine/drive_c"
        for d in "${'$'}C/Program Files"/* "${'$'}C/Program Files (x86)"/* "${'$'}C"/users/*/AppData/Local/Programs/* "${'$'}C/DesktopHub"/*; do
          [ -d "${'$'}d" ] || continue
          case "$(basename "${'$'}d")" in "Common Files"|"Internet Explorer"|"Windows Media Player"|"Windows NT"|"wine"|"Windows Photo Viewer") continue;; esac
          KIND=""
          [ -n "$(find "${'$'}d" -maxdepth 3 -iname flutter_windows.dll 2>/dev/null | head -n 1)" ] && KIND="${'$'}KIND Flutter"
          [ -n "$(find "${'$'}d" -maxdepth 3 -iname '*.asar' 2>/dev/null | head -n 1)" ] && KIND="${'$'}KIND Electron"
          [ -n "$(find "${'$'}d" -maxdepth 3 -iname libcef.dll 2>/dev/null | head -n 1)" ] && KIND="${'$'}KIND CEF"
          [ -n "$(find "${'$'}d" -maxdepth 3 \( -iname 'Qt5Core.dll' -o -iname 'Qt6Core.dll' \) 2>/dev/null | head -n 1)" ] && KIND="${'$'}KIND Qt"
          [ -n "$(find "${'$'}d" -maxdepth 3 \( -iname jvm.dll -o -iname '*.jar' \) 2>/dev/null | head -n 1)" ] && KIND="${'$'}KIND Java"
          [ -n "$(find "${'$'}d" -maxdepth 3 \( -iname 'PresentationFramework*.dll' -o -iname '*.deps.json' -o -iname '*.runtimeconfig.json' \) 2>/dev/null | head -n 1)" ] && KIND="${'$'}KIND .NET"
          EXES="$(find "${'$'}d" -maxdepth 2 -iname '*.exe' 2>/dev/null | grep -viE 'unins|setup|update|crash' | head -n 3)"
          # i percorsi contengono spazi ("Program Files"): una riga per file
          if [ -n "${'$'}EXES" ] && printf '%s\n' "${'$'}EXES" | while IFS= read -r e; do
               grep -aqi 'mscoree.dll' "${'$'}e" 2>/dev/null && exit 0
             done; then KIND="${'$'}KIND .NET"; fi
          echo "- $(basename "${'$'}d"):${'$'}{KIND:- (non riconosciuta)}"
          printf '%s\n' "${'$'}EXES" | sed -n '1,3s|^.*/|    |p'
        done 2>/dev/null | awk '!seen[${'$'}0]++' | head -n 40
        [ -d "${'$'}C/windows/mono" ] && echo "Wine Mono (.NET): installato" || echo "Wine Mono (.NET): non installato"
        echo
        echo "== Server grafico"
        tail -n 5 "${'$'}HOME/.desktophub/xvnc.log" 2>/dev/null
    """.trimIndent()

    /** Esito di [openFile] segnalato con codici di uscita dedicati. */
    const val EXIT_NO_STORAGE = 6
    const val EXIT_NEED_WINE = 5
    const val EXIT_NO_OPENER = 7

    /**
     * Apre nel desktop un file del telefono ([phonePath] relativo alla memoria interna):
     * .exe/.msi/.bat con Wine, tutto il resto con il programma predefinito.
     */
    fun openFile(phonePath: String): String = """
        export DISPLAY=:$DISPLAY_NUM
        F=/sdcard/${Shell.quote(phonePath)}
        for i in $(seq 1 25); do [ -r "${'$'}F" ] && break; sleep 0.2; done
        if [ ! -r "${'$'}F" ]; then echo "Termux non può leggere il file" >&2; exit $EXIT_NO_STORAGE; fi
        $PHONE_LINKS
        cd "$(dirname "${'$'}F")"
        LOG="$STATE_DIR/open-file.log"
        LOWER="$(printf '%s' "${'$'}F" | tr 'A-Z' 'a-z')"
        case "${'$'}LOWER" in
          *.exe|*.msi|*.bat)
            # il pacchetto Hangover installa il comando "hangover-wine" (non "wine")
            if command -v hangover-wine >/dev/null 2>&1; then WINE=hangover-wine
            elif command -v wine >/dev/null 2>&1; then WINE=wine
            else echo "Wine non installato" >&2; exit $EXIT_NEED_WINE; fi
            [ -f "${'$'}HOME/.wine/system.reg" ] || echo FIRST_WINE_RUN
            $PROCESS_WARNING
            ${wineCompat("\"\$WINE\"")}
            # La memoria del telefono è montata "noexec" e gli installer hanno spesso bisogno
            # dei file vicini (.cab, .bin, data...): si copia l'intera cartella scelta dentro
            # il disco C: di Wine e si esegue da lì.
            SRC_DIR="$(dirname "${'$'}F")"
            DEST="${'$'}HOME/.wine/drive_c/DesktopHub/$(basename "${'$'}SRC_DIR")"
            mkdir -p "${'$'}DEST"
            cp -rf "${'$'}SRC_DIR"/. "${'$'}DEST"/
            TARGET="${'$'}DEST/$(basename "${'$'}F")"
            cd "${'$'}DEST"
            export EXITF="$STATE_DIR/open-file.exit"
            rm -f "${'$'}EXITF"
            case "${'$'}LOWER" in
              *.msi) RUN="msiexec /i" ;;
              *) RUN="start /wait /unix" ;;
            esac
            # ${'$'}RUN va diviso in parole di proposito
            setsid nohup bash -c '"${'$'}@"; echo ${'$'}? > "${'$'}EXITF"' _ "${'$'}WINE" ${'$'}RUN "${'$'}TARGET" \
              > "${'$'}LOG" 2>&1 < /dev/null &
            # si aspetta poco: la prima volta Wine si prepara per minuti e va lasciato lavorare
            for i in $(seq 1 40); do [ -f "${'$'}EXITF" ] && break; sleep 0.2; done
            if [ -f "${'$'}EXITF" ] && [ "$(cat "${'$'}EXITF")" != "0" ]; then
              echo "APP_FAILED:$(cat "${'$'}EXITF")"
              grep -vE '^[0-9a-f]+:fixme:|^$' "${'$'}LOG" | tail -n 12 >&2
              exit $EXIT_APP_FAILED
            fi
            ;;
          *)
            # NB: in Termux "xdg-open" apre il file nelle app Android: servono gli opener del desktop
            OPENER=""
            for o in exo-open xdg-utils-xdg-open; do
              if command -v "${'$'}o" >/dev/null 2>&1; then OPENER="${'$'}o"; break; fi
            done
            if [ -z "${'$'}OPENER" ] && command -v gio >/dev/null 2>&1; then OPENER="gio open"; fi
            if [ -z "${'$'}OPENER" ]; then echo "Nessun programma per aprire il file" >&2; exit $EXIT_NO_OPENER; fi
            setsid nohup ${'$'}OPENER "${'$'}F" > "${'$'}LOG" 2>&1 < /dev/null &
            ;;
        esac
        echo OPENED
    """.trimIndent()
}
