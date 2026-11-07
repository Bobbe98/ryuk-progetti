package com.ryuk.desktophub.vnc

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.text.InputType
import android.view.HapticFeedbackConstants
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewConfiguration
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import com.ryuk.desktophub.data.InputMode
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.min

/**
 * Mostra il desktop remoto e traduce i gesti touch in mouse/tastiera.
 *
 * Tocco diretto: tocca = clic sinistro, tieni premuto = clic destro, trascina = trascinamento
 * con tasto sinistro. Touchpad: il dito muove il puntatore, tocca = clic, due dita toccano =
 * clic destro, tieni premuto e trascina = trascinamento.
 * In entrambi: due dita = scorrimento (rotella), pizzica = zoom, due dita con zoom = sposta la vista.
 */
@SuppressLint("ViewConstructor")
class RemoteDesktopView(context: Context) : View(context) {

    var client: RfbClient? = null
    var inputMode: InputMode = InputMode.TOUCH

    /** Modificatori "a scatto" (Ctrl/Alt/Super) attivati dalla barra tasti: valgono per il prossimo tasto. */
    val stickyModifiers = linkedSetOf<Int>()
    var onStickyModifiersConsumed: (() -> Unit)? = null

    private var bitmap: Bitmap? = null
    private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val drawMatrix = Matrix()

    private var zoom = 1f
    private var tx = 0f
    private var ty = 0f

    // Posizione del puntatore nelle coordinate del desktop
    private var cursorX = 0f
    private var cursorY = 0f
    private var buttons = 0

    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop.toFloat()
    private val longPressTimeout = ViewConfiguration.getLongPressTimeout().toLong()

    init {
        isFocusable = true
        isFocusableInTouchMode = true
        setBackgroundColor(Color.BLACK)
    }

    // --- Aggiornamento immagine ------------------------------------------------------------

    fun onFrameResized(w: Int, h: Int) {
        val c = client ?: return
        synchronized(c.frameLock) {
            bitmap = if (w > 0 && h > 0) Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888) else null
        }
        cursorX = w / 2f
        cursorY = h / 2f
        post {
            zoom = 1f
            clampPan(center = true)
            invalidate()
        }
    }

    fun onFrameUpdate(x: Int, y: Int, w: Int, h: Int) {
        val c = client ?: return
        synchronized(c.frameLock) {
            val bmp = bitmap ?: return
            val fbW = c.fbWidth
            if (bmp.width != fbW || bmp.height != c.fbHeight) return
            val cw = min(w, bmp.width - x)
            val ch = min(h, bmp.height - y)
            if (cw <= 0 || ch <= 0) return
            bmp.setPixels(c.framebuffer, y * fbW + x, fbW, x, y, cw, ch)
        }
        postInvalidateOnAnimation()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        clampPan(center = zoom <= 1.001f)
    }

    override fun onDraw(canvas: Canvas) {
        val c = client ?: return
        synchronized(c.frameLock) {
            val bmp = bitmap ?: return
            val s = scale()
            drawMatrix.setScale(s, s)
            drawMatrix.postTranslate(tx, ty)
            canvas.drawBitmap(bmp, drawMatrix, paint)
        }
    }

    // --- Trasformazioni ------------------------------------------------------------------

    private fun fbW() = client?.fbWidth ?: 0
    private fun fbH() = client?.fbHeight ?: 0

    private fun baseScale(): Float {
        if (fbW() == 0 || fbH() == 0 || width == 0 || height == 0) return 1f
        return min(width.toFloat() / fbW(), height.toFloat() / fbH())
    }

    private fun scale() = baseScale() * zoom

    private fun clampPan(center: Boolean = false) {
        val s = scale()
        val cw = fbW() * s
        val ch = fbH() * s
        tx = if (cw <= width || center) (width - cw) / 2f else tx.coerceIn(width - cw, 0f)
        ty = if (ch <= height || center) (height - ch) / 2f else ty.coerceIn(height - ch, 0f)
    }

    private fun toFbX(vx: Float) = (vx - tx) / scale()
    private fun toFbY(vy: Float) = (vy - ty) / scale()

    /** Con lo zoom attivo, sposta la vista per tenere visibile il puntatore (modalità touchpad). */
    private fun keepCursorVisible() {
        if (zoom <= 1.001f) return
        val s = scale()
        val sx = cursorX * s + tx
        val sy = cursorY * s + ty
        val margin = 48f
        if (sx < margin) tx += margin - sx
        if (sx > width - margin) tx -= sx - (width - margin)
        if (sy < margin) ty += margin - sy
        if (sy > height - margin) ty -= sy - (height - margin)
        clampPan()
        invalidate()
    }

    // --- Mouse ---------------------------------------------------------------------------

    private fun movePointer(fx: Float, fy: Float) {
        cursorX = fx.coerceIn(0f, (fbW() - 1).coerceAtLeast(0).toFloat())
        cursorY = fy.coerceIn(0f, (fbH() - 1).coerceAtLeast(0).toFloat())
        client?.sendPointer(cursorX.toInt(), cursorY.toInt(), buttons)
    }

    private fun setButtons(mask: Int) {
        buttons = mask
        client?.sendPointer(cursorX.toInt(), cursorY.toInt(), buttons)
    }

    private fun click(button: Int) {
        setButtons(buttons or button)
        setButtons(buttons and button.inv())
    }

    private fun scrollWheel(up: Boolean) = click(if (up) BTN_WHEEL_UP else BTN_WHEEL_DOWN)

    // --- Gesti ---------------------------------------------------------------------------

    private var downX = 0f
    private var downY = 0f
    private var lastX = 0f
    private var lastY = 0f
    private var downTime = 0L
    private var moved = false
    private var multiTouch = false
    private var twoFingerMoved = false
    private var longPressFired = false
    private var dragging = false
    private var lastCx = 0f
    private var lastCy = 0f
    private var scrollAccum = 0f
    private var scaling = false

    private val longPress = Runnable {
        if (moved || multiTouch) return@Runnable
        longPressFired = true
        performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        when (inputMode) {
            InputMode.TOUCH -> {
                movePointer(toFbX(downX), toFbY(downY))
                click(BTN_RIGHT)
            }
            InputMode.TOUCHPAD -> {
                dragging = true
                setButtons(buttons or BTN_LEFT)
            }
        }
    }

    private val scaleDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
            scaling = true
            return true
        }

        override fun onScale(detector: ScaleGestureDetector): Boolean {
            val newZoom = (zoom * detector.scaleFactor).coerceIn(1f, 6f)
            if (newZoom == zoom) return true
            // mantiene fermo il punto sotto le dita
            val fx = toFbX(detector.focusX)
            val fy = toFbY(detector.focusY)
            zoom = newZoom
            val s = scale()
            tx = detector.focusX - fx * s
            ty = detector.focusY - fy * s
            clampPan(center = zoom <= 1.001f)
            twoFingerMoved = true
            invalidate()
            return true
        }
    })

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
        if (client == null) return false
        scaleDetector.onTouchEvent(e)

        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                requestFocus()
                downX = e.x; downY = e.y; lastX = e.x; lastY = e.y
                downTime = e.eventTime
                moved = false; multiTouch = false; twoFingerMoved = false
                longPressFired = false; dragging = false; scaling = false
                scrollAccum = 0f
                if (inputMode == InputMode.TOUCH) movePointer(toFbX(e.x), toFbY(e.y))
                postDelayed(longPress, longPressTimeout)
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                removeCallbacks(longPress)
                if (dragging) {
                    dragging = false
                    setButtons(buttons and BTN_LEFT.inv())
                }
                multiTouch = true
                lastCx = centroidX(e); lastCy = centroidY(e)
            }

            MotionEvent.ACTION_MOVE -> {
                if (multiTouch) {
                    if (e.pointerCount >= 2) handleTwoFingerMove(e)
                } else {
                    handleOneFingerMove(e)
                }
            }

            MotionEvent.ACTION_POINTER_UP -> {
                if (e.pointerCount == 2 && !twoFingerMoved && !scaling &&
                    e.eventTime - downTime < TAP_TIMEOUT
                ) {
                    // tocco con due dita = clic destro
                    if (inputMode == InputMode.TOUCH) movePointer(toFbX(centroidX(e)), toFbY(centroidY(e)))
                    click(BTN_RIGHT)
                    twoFingerMoved = true
                }
                // ricalcola il baricentro con le dita rimaste
                lastCx = centroidX(e, excludeIndex = e.actionIndex)
                lastCy = centroidY(e, excludeIndex = e.actionIndex)
            }

            MotionEvent.ACTION_UP -> {
                removeCallbacks(longPress)
                if (!multiTouch) {
                    when {
                        dragging -> {
                            dragging = false
                            setButtons(buttons and BTN_LEFT.inv())
                        }
                        !moved && !longPressFired -> {
                            if (inputMode == InputMode.TOUCH) movePointer(toFbX(e.x), toFbY(e.y))
                            click(BTN_LEFT)
                        }
                    }
                }
                multiTouch = false
            }

            MotionEvent.ACTION_CANCEL -> {
                removeCallbacks(longPress)
                if (buttons != 0) setButtons(0)
                dragging = false
                multiTouch = false
            }
        }
        return true
    }

    private fun handleOneFingerMove(e: MotionEvent) {
        if (!moved && hypot(e.x - downX, e.y - downY) > touchSlop) {
            moved = true
            removeCallbacks(longPress)
            if (inputMode == InputMode.TOUCH && !longPressFired) {
                // inizio trascinamento con il tasto sinistro dal punto toccato
                movePointer(toFbX(downX), toFbY(downY))
                dragging = true
                setButtons(buttons or BTN_LEFT)
            }
        }
        if (!moved) return
        when (inputMode) {
            InputMode.TOUCH -> if (!longPressFired || dragging) movePointer(toFbX(e.x), toFbY(e.y))
            InputMode.TOUCHPAD -> {
                // velocità indipendente dallo zoom, con lieve accelerazione
                val dx = e.x - lastX
                val dy = e.y - lastY
                val speed = 1f + min(hypot(dx, dy) / 40f, 1.5f)
                val k = speed / baseScale()
                movePointer(cursorX + dx * k, cursorY + dy * k)
                keepCursorVisible()
            }
        }
        lastX = e.x
        lastY = e.y
    }

    private fun handleTwoFingerMove(e: MotionEvent) {
        val cx = centroidX(e)
        val cy = centroidY(e)
        val dx = cx - lastCx
        val dy = cy - lastCy
        lastCx = cx
        lastCy = cy
        if (scaleDetector.isInProgress && abs(scaleDetector.scaleFactor - 1f) > 0.01f) return
        if (abs(dx) + abs(dy) > 0.5f) {
            if (hypot(cx - downX, cy - downY) > touchSlop) twoFingerMoved = true
        }
        if (zoom > 1.001f) {
            tx += dx
            ty += dy
            clampPan()
            invalidate()
        } else {
            scrollAccum += dy
            val step = 40f * resources.displayMetrics.density
            while (scrollAccum > step) {
                scrollWheel(up = true) // dita verso il basso = contenuto verso l'alto
                scrollAccum -= step
                twoFingerMoved = true
            }
            while (scrollAccum < -step) {
                scrollWheel(up = false)
                scrollAccum += step
                twoFingerMoved = true
            }
        }
    }

    private fun centroidX(e: MotionEvent, excludeIndex: Int = -1): Float {
        var sum = 0f; var n = 0
        for (i in 0 until e.pointerCount) if (i != excludeIndex) { sum += e.getX(i); n++ }
        return if (n == 0) e.x else sum / n
    }

    private fun centroidY(e: MotionEvent, excludeIndex: Int = -1): Float {
        var sum = 0f; var n = 0
        for (i in 0 until e.pointerCount) if (i != excludeIndex) { sum += e.getY(i); n++ }
        return if (n == 0) e.y else sum / n
    }

    fun resetZoom() {
        zoom = 1f
        clampPan(center = true)
        invalidate()
    }

    // --- Tastiera -----------------------------------------------------------------------

    /** Invia un tasto applicando gli eventuali modificatori a scatto. */
    fun typeKeysym(keysym: Int) {
        val c = client ?: return
        val mods = stickyModifiers.toList()
        mods.forEach { c.sendKey(it, true) }
        c.tapKey(keysym)
        mods.asReversed().forEach { c.sendKey(it, false) }
        if (mods.isNotEmpty()) {
            stickyModifiers.clear()
            onStickyModifiersConsumed?.invoke()
        }
    }

    fun typeText(text: CharSequence) {
        var i = 0
        while (i < text.length) {
            val cp = Character.codePointAt(text, i)
            typeKeysym(KeySyms.forChar(cp))
            i += Character.charCount(cp)
        }
    }

    override fun onCheckIsTextEditor() = true

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection {
        // "password visibile" evita correttore e testo in composizione nella maggior parte delle tastiere
        outAttrs.inputType = InputType.TYPE_CLASS_TEXT or
            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD or
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        outAttrs.imeOptions = EditorInfo.IME_FLAG_NO_FULLSCREEN or
            EditorInfo.IME_FLAG_NO_EXTRACT_UI or
            EditorInfo.IME_ACTION_NONE
        return DesktopInputConnection()
    }

    private inner class DesktopInputConnection : BaseInputConnection(this, false) {
        private var composing = ""

        override fun commitText(text: CharSequence, newCursorPosition: Int): Boolean {
            replaceComposing("")
            typeText(text)
            return true
        }

        override fun setComposingText(text: CharSequence, newCursorPosition: Int): Boolean {
            replaceComposing(text.toString())
            return true
        }

        override fun finishComposingText(): Boolean {
            composing = ""
            return true
        }

        override fun deleteSurroundingText(beforeLength: Int, afterLength: Int): Boolean {
            repeat(beforeLength.coerceAtMost(64)) { typeKeysym(KeySyms.BACKSPACE) }
            repeat(afterLength.coerceAtMost(64)) { typeKeysym(KeySyms.DELETE) }
            return true
        }

        override fun sendKeyEvent(event: KeyEvent): Boolean {
            if (event.action == KeyEvent.ACTION_DOWN) handleKeyDown(event)
            return true
        }

        private fun replaceComposing(new: String) {
            // il testo in composizione è già stato digitato: si corregge con backspace
            var common = 0
            while (common < composing.length && common < new.length && composing[common] == new[common]) common++
            repeat(composing.length - common) { typeKeysym(KeySyms.BACKSPACE) }
            typeText(new.substring(common))
            composing = new
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) return super.onKeyDown(keyCode, event)
        return handleKeyDown(event) || super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        val sym = KeySyms.forKeyCode(keyCode)
        if (sym != null && isModifier(sym)) {
            client?.sendKey(sym, false)
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    private fun isModifier(sym: Int) =
        sym == KeySyms.SHIFT_L || sym == KeySyms.CONTROL_L || sym == KeySyms.ALT_L || sym == KeySyms.SUPER_L

    /** Tasti fisici o inviati dalla tastiera virtuale (frecce, invio, cancella...). */
    private fun handleKeyDown(event: KeyEvent): Boolean {
        val c = client ?: return false
        val sym = KeySyms.forKeyCode(event.keyCode)
        if (sym != null) {
            if (isModifier(sym)) c.sendKey(sym, true) else typeKeysym(sym)
            return true
        }
        // carattere senza Ctrl/Alt (i modificatori fisici sono già inviati come tasti)
        val unicode = event.getUnicodeChar(event.metaState and (KeyEvent.META_SHIFT_MASK or KeyEvent.META_CAPS_LOCK_ON))
        if (unicode > 0) {
            typeKeysym(KeySyms.forChar(unicode))
            return true
        }
        return false
    }

    companion object {
        const val BTN_LEFT = 1
        const val BTN_MIDDLE = 2
        const val BTN_RIGHT = 4
        const val BTN_WHEEL_UP = 8
        const val BTN_WHEEL_DOWN = 16
        private const val TAP_TIMEOUT = 300L
    }
}
