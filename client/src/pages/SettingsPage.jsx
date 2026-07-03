import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { getServerUrl, setServerUrl, getApiBase } from '../serverConfig';
import SRD_CREATURES from '../data/creatures.json';
import SRD_ITEMS from '../data/items.json';

export default function SettingsPage() {
  const [url, setUrl] = useState(getServerUrl());
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  if (Capacitor.isNativePlatform()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-amber-300">Impostazioni</h1>
        <p className="mt-4 rounded bg-emerald-900/40 px-3 py-2 text-sm text-emerald-300">
          Questa app funziona completamente offline: {SRD_CREATURES.length} creature e {SRD_ITEMS.length} oggetti SRD
          sono incorporati nell'APK, e le creature/oggetti homebrew che crei vengono salvati direttamente sul telefono.
          Non è richiesto nessun server.
        </p>
      </div>
    );
  }

  function save() {
    setServerUrl(url);
    setStatus({ ok: true, message: 'Indirizzo salvato.' });
  }

  async function test() {
    setTesting(true);
    setStatus(null);
    try {
      setServerUrl(url);
      const res = await fetch(`${getApiBase()}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus({ ok: !!data.ok, message: data.ok ? 'Connessione riuscita!' : 'Risposta inattesa dal server.' });
    } catch (e) {
      setStatus({ ok: false, message: `Connessione fallita: ${e.message}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-amber-300">Impostazioni</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Indica l'indirizzo del server (es. <code className="text-zinc-300">http://192.168.1.10:4000</code>).
        Sul telefono il server dev'essere raggiungibile dalla stessa rete (o pubblicato online).
      </p>

      <label className="mt-6 block text-sm">
        <span className="mb-1 block text-zinc-400">Indirizzo del server</span>
        <input
          className="input"
          placeholder="http://192.168.1.10:4000"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>

      <div className="mt-4 flex gap-3">
        <button onClick={save} className="rounded bg-amber-600 px-5 py-2 font-semibold hover:bg-amber-500">
          Salva
        </button>
        <button onClick={test} disabled={testing} className="rounded bg-white/10 px-5 py-2 font-semibold hover:bg-white/20 disabled:opacity-50">
          {testing ? 'Verifica...' : 'Testa connessione'}
        </button>
      </div>

      {status && (
        <p className={`mt-4 rounded px-3 py-2 text-sm ${status.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
          {status.message}
        </p>
      )}
    </div>
  );
}
