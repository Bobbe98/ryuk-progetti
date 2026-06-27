import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import EntityImage from '../components/EntityImage';
import { TYPE_LABELS, ENVIRONMENT_LABELS, cr } from '../i18n';

export default function EncounterGeneratorPage() {
  const [meta, setMeta] = useState(null);
  const [mode, setMode] = useState('cr');
  const [form, setForm] = useState({
    cr: 3, environment: '', creatureCount: '',
    partyLevel: 4, partySize: 4, difficulty: 'medium',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const payload = mode === 'cr'
        ? { mode, cr: Number(form.cr), environment: form.environment || null, creatureCount: form.creatureCount ? Number(form.creatureCount) : null }
        : { mode, environment: form.environment || null, partyLevel: Number(form.partyLevel), partySize: Number(form.partySize), difficulty: form.difficulty };
      const data = await api.generateEncounter(payload);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-amber-300">Generatore di incontri</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Genera un incontro casuale a partire da un Grado di Sfida target (con eventuale ambiente), oppure calcola il
        budget XP corretto in base a livello e dimensione del gruppo.
      </p>

      <div className="mt-5 flex gap-2">
        <button onClick={() => setMode('cr')} className={`rounded px-3 py-1.5 text-sm ${mode === 'cr' ? 'bg-amber-600' : 'bg-white/10'}`}>Per Grado di Sfida</button>
        <button onClick={() => setMode('party')} className={`rounded px-3 py-1.5 text-sm ${mode === 'party' ? 'bg-amber-600' : 'bg-white/10'}`}>Per gruppo</button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-4">
        {mode === 'cr' ? (
          <>
            <Field label="Grado di Sfida target"><input type="number" step="0.125" className="input" value={form.cr} onChange={(e) => set('cr', e.target.value)} /></Field>
            <Field label="Numero creature (opzionale)"><input type="number" className="input" value={form.creatureCount} onChange={(e) => set('creatureCount', e.target.value)} placeholder="auto" /></Field>
          </>
        ) : (
          <>
            <Field label="Livello gruppo"><input type="number" min="1" max="20" className="input" value={form.partyLevel} onChange={(e) => set('partyLevel', e.target.value)} /></Field>
            <Field label="N° personaggi"><input type="number" min="1" className="input" value={form.partySize} onChange={(e) => set('partySize', e.target.value)} /></Field>
            <Field label="Difficoltà">
              <select className="input" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
                <option value="easy">Facile</option>
                <option value="medium">Media</option>
                <option value="hard">Difficile</option>
                <option value="deadly">Mortale</option>
              </select>
            </Field>
          </>
        )}
        <Field label="Ambiente">
          <select className="input" value={form.environment} onChange={(e) => set('environment', e.target.value)}>
            <option value="">Qualsiasi</option>
            {meta?.environments.map((e) => <option key={e} value={e}>{ENVIRONMENT_LABELS[e] || e}</option>)}
          </select>
        </Field>
      </div>

      <button onClick={generate} disabled={loading} className="mt-4 rounded bg-amber-600 px-5 py-2 font-semibold hover:bg-amber-500 disabled:opacity-50">
        {loading ? 'Generazione...' : 'Genera incontro'}
      </button>

      {error && <p className="mt-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>}

      {result && (
        <div className="mt-6">
          <div className="mb-3 flex gap-4 text-sm text-zinc-400">
            <span>Budget XP: <b className="text-zinc-200">{result.budgetXp}</b></span>
            <span>XP incontro (con moltiplicatore): <b className="text-zinc-200">{result.adjustedXp}</b></span>
            {result.environment && <span>Ambiente: <b className="text-zinc-200">{ENVIRONMENT_LABELS[result.environment]}</b></span>}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {result.creatures.map((c) => (
              <Link key={c.id} to={`/creature/${c.id}`} className="group overflow-hidden rounded-lg border border-white/10 bg-white/5 hover:border-amber-500/50">
                <EntityImage src={c.image_url} name={c.name} className="h-28 w-full object-cover" />
                <div className="p-2">
                  <p className="truncate text-sm font-medium group-hover:text-amber-300">{c.name}</p>
                  <p className="text-xs text-zinc-400">GS {cr(c.cr)} · {TYPE_LABELS[c.type] || c.type}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
