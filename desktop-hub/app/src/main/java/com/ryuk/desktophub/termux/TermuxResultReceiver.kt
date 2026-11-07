package com.ryuk.desktophub.termux

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Riceve da Termux il risultato dei comandi eseguiti in background. */
class TermuxResultReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(EXTRA_REQUEST_ID, -1)
        if (id < 0) return
        val bundle = intent.getBundleExtra("result")
        val result = TermuxBridge.CommandResult(
            stdout = bundle?.getString("stdout").orEmpty(),
            stderr = bundle?.getString("stderr").orEmpty(),
            exitCode = bundle?.getInt("exitCode", -1) ?: -1,
            termuxError = bundle?.getInt("err", -1) ?: -1,
            termuxErrorMessage = bundle?.getString("errmsg"),
        )
        TermuxBridge.deliver(id, result)
    }

    companion object {
        const val EXTRA_REQUEST_ID = "com.ryuk.desktophub.REQUEST_ID"
    }
}
