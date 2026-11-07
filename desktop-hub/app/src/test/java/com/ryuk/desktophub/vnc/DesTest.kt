package com.ryuk.desktophub.vnc

import org.junit.Assert.assertArrayEquals
import org.junit.Test
import java.util.Random
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

class DesTest {

    private fun hex(s: String) = s.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

    @Test
    fun knownVector() {
        // Vettore classico: chiave 133457799BBCDFF1, testo 0123456789ABCDEF -> 85E813540F0AB405
        val out = Des.encryptBlock(hex("133457799BBCDFF1"), hex("0123456789ABCDEF"))
        assertArrayEquals(hex("85E813540F0AB405"), out)
    }

    @Test
    fun matchesJdkDes() {
        val rnd = Random(42)
        repeat(200) {
            val key = ByteArray(8).also(rnd::nextBytes)
            val block = ByteArray(8).also(rnd::nextBytes)
            val cipher = Cipher.getInstance("DES/ECB/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "DES"))
            assertArrayEquals(cipher.doFinal(block), Des.encryptBlock(key, block))
        }
    }
}
