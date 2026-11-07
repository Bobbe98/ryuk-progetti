package com.ryuk.desktophub.vnc

import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.Executors
import kotlin.concurrent.thread

/**
 * Client VNC (protocollo RFB 3.3/3.7/3.8) essenziale.
 *
 * Encoding supportati: Raw, CopyRect e DesktopSize. Sono sufficienti e veloci perché il
 * server gira sullo stesso telefono (127.0.0.1), dove la banda non è un problema.
 * Il cursore viene disegnato dal server dentro l'immagine.
 */
class RfbClient(
    private val host: String,
    private val port: Int,
    private val password: String,
    private val listener: Listener,
) {

    interface Listener {
        fun onConnected(width: Int, height: Int, name: String)
        fun onResize(width: Int, height: Int)
        /** Chiamato dal thread di rete dopo aver scritto il rettangolo in [framebuffer]. */
        fun onUpdate(x: Int, y: Int, w: Int, h: Int)
        fun onClipboard(text: String)
        fun onDisconnected(error: Throwable?)
    }

    /** Pixel ARGB del desktop remoto. Accedere tenendo il lock [frameLock]. */
    @Volatile var framebuffer = IntArray(0); private set
    @Volatile var fbWidth = 0; private set
    @Volatile var fbHeight = 0; private set
    val frameLock = Any()

    @Volatile private var running = false
    private var socket: Socket? = null
    private lateinit var input: DataInputStream
    private lateinit var output: DataOutputStream
    private val sender = Executors.newSingleThreadExecutor()
    private var rawBuffer = ByteArray(0)

    fun connect() {
        running = true
        thread(name = "rfb-client", isDaemon = true) {
            var error: Throwable? = null
            try {
                handshake()
                messageLoop()
            } catch (t: Throwable) {
                if (running) error = t
            } finally {
                running = false
                runCatching { socket?.close() }
                listener.onDisconnected(error)
            }
        }
    }

    fun disconnect() {
        running = false
        runCatching { socket?.close() }
        sender.shutdownNow()
    }

    // --- Handshake ---------------------------------------------------------------------

    private fun handshake() {
        val s = Socket()
        s.tcpNoDelay = true
        s.connect(InetSocketAddress(host, port), 3000)
        socket = s
        input = DataInputStream(BufferedInputStream(s.getInputStream(), 1 shl 16))
        output = DataOutputStream(BufferedOutputStream(s.getOutputStream(), 1 shl 14))

        val versionBytes = ByteArray(12)
        input.readFully(versionBytes)
        val version = String(versionBytes, Charsets.US_ASCII)
        if (!version.startsWith("RFB ")) throw IOException("Il server non è un server VNC")
        val minor = version.substring(8, 11).toIntOrNull() ?: 3
        val useMinor = when {
            minor >= 8 -> 8
            minor == 7 -> 7
            else -> 3
        }
        output.write("RFB 003.00$useMinor\n".toByteArray(Charsets.US_ASCII))
        output.flush()

        val secType: Int
        if (useMinor >= 7) {
            val count = input.readUnsignedByte()
            if (count == 0) throw IOException("Connessione rifiutata: ${readReason()}")
            val types = ByteArray(count).also { input.readFully(it) }.map { it.toInt() and 0xFF }
            secType = when {
                2 in types -> 2
                1 in types -> 1
                else -> throw IOException("Metodo di sicurezza non supportato: $types")
            }
            output.writeByte(secType)
            output.flush()
        } else {
            secType = input.readInt()
            if (secType == 0) throw IOException("Connessione rifiutata: ${readReason()}")
        }

        if (secType == 2) {
            val challenge = ByteArray(16).also { input.readFully(it) }
            output.write(Des.vncResponse(password, challenge))
            output.flush()
        }
        if (secType == 2 || useMinor >= 8) {
            val result = input.readInt()
            if (result != 0) {
                val reason = if (useMinor >= 8) readReason() else ""
                throw IOException("Autenticazione VNC fallita. $reason".trim())
            }
        }

        // ClientInit: condiviso (non chiude altri visualizzatori)
        output.writeByte(1)
        output.flush()

        // ServerInit
        val w = input.readUnsignedShort()
        val h = input.readUnsignedShort()
        input.skipBytes(16) // pixel format del server: lo sostituiamo con il nostro
        val nameLen = input.readInt()
        val name = ByteArray(nameLen).also { input.readFully(it) }.toString(Charsets.UTF_8)

        resize(w, h)
        sendPixelFormat()
        sendEncodings()
        requestUpdate(incremental = false)
        listener.onConnected(w, h, name)
    }

    private fun readReason(): String {
        val len = input.readInt()
        return ByteArray(len).also { input.readFully(it) }.toString(Charsets.UTF_8)
    }

    private fun resize(w: Int, h: Int) {
        synchronized(frameLock) {
            fbWidth = w
            fbHeight = h
            framebuffer = IntArray(w * h)
        }
    }

    /** 32 bit per pixel, little-endian, true color: byte = B, G, R, X. */
    private fun sendPixelFormat() = writeNow {
        writeByte(0) // SetPixelFormat
        write(ByteArray(3))
        writeByte(32) // bits per pixel
        writeByte(24) // depth
        writeByte(0) // big endian = no
        writeByte(1) // true colour
        writeShort(255); writeShort(255); writeShort(255)
        writeByte(16); writeByte(8); writeByte(0) // shift R, G, B
        write(ByteArray(3))
    }

    private fun sendEncodings() = writeNow {
        val encodings = intArrayOf(ENC_COPY_RECT, ENC_RAW, ENC_DESKTOP_SIZE)
        writeByte(2) // SetEncodings
        writeByte(0)
        writeShort(encodings.size)
        encodings.forEach { writeInt(it) }
    }

    private fun requestUpdate(incremental: Boolean) {
        // Chiamato dal thread di lettura: scrive direttamente (l'output è sincronizzato).
        synchronized(output) {
            output.writeByte(3)
            output.writeByte(if (incremental) 1 else 0)
            output.writeShort(0); output.writeShort(0)
            output.writeShort(fbWidth); output.writeShort(fbHeight)
            output.flush()
        }
    }

    // --- Messaggi dal server -------------------------------------------------------------

    private fun messageLoop() {
        while (running) {
            when (val type = input.readUnsignedByte()) {
                0 -> {
                    readFramebufferUpdate()
                    requestUpdate(incremental = true)
                }
                1 -> { // SetColourMapEntries (non usato in true color)
                    input.skipBytes(1)
                    input.readUnsignedShort()
                    val n = input.readUnsignedShort()
                    input.skipBytes(n * 6)
                }
                2 -> Unit // Bell
                3 -> {
                    input.skipBytes(3)
                    val len = input.readInt()
                    val bytes = ByteArray(len).also { input.readFully(it) }
                    listener.onClipboard(String(bytes, Charsets.ISO_8859_1))
                }
                else -> throw IOException("Messaggio VNC sconosciuto: $type")
            }
        }
    }

    private fun readFramebufferUpdate() {
        input.skipBytes(1)
        val rects = input.readUnsignedShort()
        var resized = false
        repeat(rects) {
            val x = input.readUnsignedShort()
            val y = input.readUnsignedShort()
            val w = input.readUnsignedShort()
            val h = input.readUnsignedShort()
            when (val enc = input.readInt()) {
                ENC_RAW -> readRaw(x, y, w, h)
                ENC_COPY_RECT -> copyRect(x, y, w, h, input.readUnsignedShort(), input.readUnsignedShort())
                ENC_DESKTOP_SIZE -> {
                    resize(w, h)
                    listener.onResize(w, h)
                    resized = true
                }
                else -> throw IOException("Encoding non supportato: $enc")
            }
        }
        if (resized) requestUpdate(incremental = false)
    }

    private fun readRaw(x: Int, y: Int, w: Int, h: Int) {
        if (w == 0 || h == 0) return
        val rowBytes = w * 4
        if (rawBuffer.size < rowBytes) rawBuffer = ByteArray(rowBytes)
        val buf = rawBuffer
        for (row in 0 until h) {
            input.readFully(buf, 0, rowBytes)
            synchronized(frameLock) {
                val fb = framebuffer
                val stride = fbWidth
                if (y + row >= fbHeight) return@synchronized
                var o = (y + row) * stride + x
                var i = 0
                val maxCol = minOf(w, stride - x)
                for (col in 0 until maxCol) {
                    fb[o++] = (0xFF shl 24) or
                        ((buf[i + 2].toInt() and 0xFF) shl 16) or
                        ((buf[i + 1].toInt() and 0xFF) shl 8) or
                        (buf[i].toInt() and 0xFF)
                    i += 4
                }
            }
        }
        listener.onUpdate(x, y, w, h)
    }

    private fun copyRect(x: Int, y: Int, w: Int, h: Int, sx: Int, sy: Int) {
        synchronized(frameLock) {
            val fb = framebuffer
            val stride = fbWidth
            if (x + w > stride || sx + w > stride || y + h > fbHeight || sy + h > fbHeight) return@synchronized
            val tmp = IntArray(w * h)
            for (row in 0 until h) System.arraycopy(fb, (sy + row) * stride + sx, tmp, row * w, w)
            for (row in 0 until h) System.arraycopy(tmp, row * w, fb, (y + row) * stride + x, w)
        }
        listener.onUpdate(x, y, w, h)
    }

    // --- Input verso il server -------------------------------------------------------------

    /** [buttons]: bit 0 sinistro, 1 centrale, 2 destro, 3/4 rotella su/giù. */
    fun sendPointer(x: Int, y: Int, buttons: Int) {
        val cx = x.coerceIn(0, maxOf(0, fbWidth - 1))
        val cy = y.coerceIn(0, maxOf(0, fbHeight - 1))
        send {
            writeByte(5)
            writeByte(buttons)
            writeShort(cx)
            writeShort(cy)
        }
    }

    fun sendKey(keysym: Int, down: Boolean) = send {
        writeByte(4)
        writeByte(if (down) 1 else 0)
        writeShort(0)
        writeInt(keysym)
    }

    fun tapKey(keysym: Int) {
        sendKey(keysym, true)
        sendKey(keysym, false)
    }

    fun sendClipboard(text: String) = send {
        val bytes = text.toByteArray(Charsets.ISO_8859_1)
        writeByte(6)
        write(ByteArray(3))
        writeInt(bytes.size)
        write(bytes)
    }

    /** Scrittura sincrona: usata nell'handshake per garantire l'ordine dei messaggi. */
    private fun writeNow(block: DataOutputStream.() -> Unit) {
        synchronized(output) {
            output.block()
            output.flush()
        }
    }

    private fun send(block: DataOutputStream.() -> Unit) {
        if (!running || sender.isShutdown) return
        runCatching {
            sender.execute {
                if (!running) return@execute
                try {
                    synchronized(output) {
                        output.block()
                        output.flush()
                    }
                } catch (_: IOException) {
                    // la disconnessione verrà segnalata dal thread di lettura
                }
            }
        }
    }

    companion object {
        const val ENC_RAW = 0
        const val ENC_COPY_RECT = 1
        const val ENC_DESKTOP_SIZE = -223
    }
}
