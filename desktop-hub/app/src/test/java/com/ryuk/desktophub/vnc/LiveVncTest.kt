package com.ryuk.desktophub.vnc

import org.junit.Assume
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class LiveVncTest {
    @Test
    fun liveSession() {
        Assume.assumeTrue(System.getenv("LIVE_VNC") == "1")
        val connected = CountDownLatch(1)
        val gotFrame = CountDownLatch(1)
        val resized = CountDownLatch(1)
        var updates = 0
        var err: Throwable? = null
        lateinit var c: RfbClient
        c = RfbClient("127.0.0.1", 5901, System.getenv("VNC_PW"), object : RfbClient.Listener {
            override fun onConnected(width: Int, height: Int, name: String) { println("connected $width x $height '$name'"); connected.countDown() }
            override fun onResize(width: Int, height: Int) { println("resize $width x $height"); resized.countDown() }
            var area = 0L
            override fun onUpdate(x: Int, y: Int, w: Int, h: Int) { updates++; area += w.toLong() * h; if (area >= 1280L * 592) gotFrame.countDown() }
            override fun onClipboard(text: String) { println("clipboard: $text") }
            override fun onDisconnected(error: Throwable?) { err = error; println("disconnected: $error") }
        })
        c.connect()
        check(connected.await(5, TimeUnit.SECONDS)) { "no connect: $err" }
        check(gotFrame.await(5, TimeUnit.SECONDS)) { "no frame" }
        // move pointer into the xev window, click and type
        c.sendPointer(800, 200, 0); Thread.sleep(200)
        c.sendPointer(800, 200, 1); c.sendPointer(800, 200, 0)
        "Az!è".forEach { c.tapKey(KeySyms.forChar(it.code)) }
        c.tapKey(KeySyms.RETURN)
        Thread.sleep(1500)
        File(System.getenv("OUT_DIR"), "ready").writeText("1")
        // wait for an external xrandr resize
        val r = resized.await(15, TimeUnit.SECONDS)
        Thread.sleep(1500)
        synchronized(c.frameLock) {
            val out = java.io.ByteArrayOutputStream()
            out.write("P6\n${c.fbWidth} ${c.fbHeight}\n255\n".toByteArray())
            for (p in c.framebuffer) { out.write(p shr 16 and 255); out.write(p shr 8 and 255); out.write(p and 255) }
            File(System.getenv("OUT_DIR"), "frame.ppm").writeBytes(out.toByteArray())
        }
        println("updates=$updates resized=$r")
        c.disconnect()
    }
}
