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
        inst() { apt-get install -y -o Dpkg::Options::=--force-confnew -o Dpkg::Options::=--force-confdef "${'$'}@"; }
        ensure_x11_repo() {
          if ! dpkg -s x11-repo >/dev/null 2>&1; then
            apt-get update && inst x11-repo
          fi
          apt-get update
        }
    """.trimIndent()

    private fun terminalWrapper(title: String, body: String, done: String) = listOf(
        "set -e",
        "trap 'echo; echo \"[X] Operazione non riuscita: controlla i messaggi qui sopra.\"; " +
            "echo \"    Puoi riprovare da Desktop Hub.\"' ERR",
        COMMON,
        "echo \"==================================================\"",
        "echo \" Desktop Hub - $title\"",
        "echo \"==================================================\"",
        body,
        "echo",
        "echo \"[OK] $done\"",
        "echo \"Torna su Desktop Hub e premi Aggiorna.\"",
    ).joinToString("\n")

    /** Prima configurazione: server X/VNC e ambiente desktop. */
    fun setup(env: DesktopEnvironment): String = terminalWrapper(
        title = "preparazione ambiente desktop",
        body = """
            apt-get update
            apt-get -y -o Dpkg::Options::=--force-confnew -o Dpkg::Options::=--force-confdef full-upgrade
            ensure_x11_repo
            inst tigervnc procps dbus ${env.packages}
            mkdir -p "$STATE_DIR" ~/.vnc
            date > "$STATE_DIR/ready"
        """.trimIndent(),
        done = "Ambiente desktop pronto.",
    )

    fun installApp(app: DesktopApp): String = terminalWrapper(
        title = "installazione di ${app.name.replace("\"", "")}",
        body = "ensure_x11_repo\n${app.install}",
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
        appendLine("pgrep -x Xvnc >/dev/null 2>&1 && [ -S \"\$PREFIX/tmp/.X11-unix/X$DISPLAY_NUM\" ] && echo DESKTOP_RUNNING")
        for (env in DesktopEnvironment.entries) {
            appendLine("command -v ${env.binary} >/dev/null 2>&1 && echo ENV:${env.name}")
        }
        for (app in apps) {
            appendLine("if ${app.check}; then echo ${Shell.quote("APP:" + app.id)}; fi")
        }
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
        X_SOCKET="${'$'}PREFIX/tmp/.X11-unix/X$DISPLAY_NUM"
        if ! { pgrep -x Xvnc >/dev/null 2>&1 && [ -S "${'$'}X_SOCKET" ]; }; then
          # nessun server valido: ripulisce eventuali resti e lo avvia
          pkill -x Xvnc 2>/dev/null
          rm -f "${'$'}PREFIX/tmp/.X$DISPLAY_NUM-lock" "${'$'}X_SOCKET"
          printf '%s\n' ${Shell.quote(password)} | vncpasswd -f > ~/.vnc/passwd
          chmod 600 ~/.vnc/passwd
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
        # -x confronta il nome esatto del processo (con -f lo script troverebbe se stesso)
        if ! pgrep -x ${env.processName} >/dev/null 2>&1; then
          if command -v ${env.binary} >/dev/null 2>&1; then
            setsid nohup ${env.startCommand} > "$STATE_DIR/session.log" 2>&1 < /dev/null &
          fi
        fi
        echo STARTED
    """.trimIndent()

    fun launchApp(app: DesktopApp): String = """
        export DISPLAY=:$DISPLAY_NUM
        mkdir -p "$STATE_DIR"
        setsid nohup bash -lc ${Shell.quote(app.launch)} > "$STATE_DIR/app-${app.id.filter { it.isLetterOrDigit() || it == '-' }}.log" 2>&1 < /dev/null &
        echo LAUNCHED
    """.trimIndent()

    fun stopDesktop(): String = """
        for p in ${DesktopEnvironment.entries.joinToString(" ") { it.processName }}; do pkill -x "${'$'}p" 2>/dev/null; done
        pkill -x Xvnc 2>/dev/null
        for i in $(seq 1 20); do pgrep -x Xvnc >/dev/null 2>&1 || break; sleep 0.2; done
        pkill -9 -x Xvnc 2>/dev/null
        rm -f "${'$'}PREFIX/tmp/.X$DISPLAY_NUM-lock" "${'$'}PREFIX/tmp/.X11-unix/X$DISPLAY_NUM"
        echo STOPPED
    """.trimIndent()

    /** Comando che l'utente incolla in Termux per abilitare le app esterne. */
    const val ENABLE_EXTERNAL_APPS =
        "mkdir -p ~/.termux && (grep -q '^allow-external-apps' ~/.termux/termux.properties 2>/dev/null " +
            "&& sed -i 's/^allow-external-apps.*/allow-external-apps=true/' ~/.termux/termux.properties " +
            "|| echo 'allow-external-apps=true' >> ~/.termux/termux.properties) && termux-reload-settings " +
            "&& echo 'Fatto! Torna su Desktop Hub.'"

    /** Accesso alla memoria interna (per aprire i propri file dalle app desktop). */
    const val STORAGE_SETUP = "termux-setup-storage"
}
