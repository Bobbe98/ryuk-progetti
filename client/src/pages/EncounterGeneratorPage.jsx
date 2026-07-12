import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import EntityImage from '../components/EntityImage';
import { applyOverride, applyOverrides } from '../local/overridesStore';
import { TYPE_LABELS, ENVIRONMENT_LABELS, RARITY_LABELS, RARITY_COLORS, cr } from '../i18n';

const DIFFICULTY_LABELS = { easy: 'Facile', medium: 'Media', hard: 'Difficile', deadly: 'Mortale' };

function groupCreatures(creatures) {
  const groups = new Map();
  for (const c of creatures) {
    const g = groups.get(c.id);
    if (g) g.count += 1;
    else groups.set(c.id, { creature: applyOverride('creature', c), count: 1 });
  }
  return [...groups.values()];
}

export default function EncounterGeneratorPage() {
  const [meta, setMeta] = useState(null);
  const [mode, setMode] = useState('cr');
  const [form, setForm] = useState({
    cr: 3, environment: '', creatureCount: '', creatureType: '', legendary: 'any',
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
      const common = {
        environment: form.environment || null,
        creatureType: form.creatureType || null,
        legendary: form.legendary,
      };
      const payload = mode === 'cr'
        ? { mode, ...common, cr: Number(form.cr), creatureCount: form.creatureCount ? Number(form.creatureCount) : null }
        : { mode, ...common, partyLevel: Number(form.partyLevel), partySize: Number(form.partySize), difficulty: form.difficulty };
      const data = await api.generateEncounter(payload);
      setResult({ ...data, rewards: data.rewards && { ...data.rewards, items: applyOverrides('item', data.rewards.items) } });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-amber-300">Generatore di incontri</h1>
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
        <Field label="Tipo di creatura">
          <select className="input" value={form.creatureType} onChange={(e) => set('creatureType', e.target.value)}>
            <option value="">Qualsiasi</option>
            {meta?.creatureTypes.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
          </select>
        </Field>
        <Field label="Creature leggendarie">
          <select className="input" value={form.legendary} onChange={(e) => set('legendary', e.target.value)}>
            <option value="any">Indifferente</option>
            <option value="boss">Con boss leggendario</option>
            <option value="exclude">Escludile</option>
          </select>
        </Field>
      </div>

      <button onClick={generate} disabled={loading} className="mt-4 rounded bg-amber-600 px-5 py-2 font-semibold hover:bg-amber-500 disabled:opacity-50">
        {loading ? 'Generazione...' : 'Genera incontro'}
      </button>

      {error && <p className="mt-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>}

      {result && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap gap-4 text-sm text-zinc-400">
            <span>Budget XP: <b className="text-zinc-200">{result.budgetXp}</b></span>
            <span>XP incontro (con moltiplicatore): <b className={`${result.adjustedXp > result.budgetXp * 1.1 ? 'text-red-300' : 'text-emerald-300'}`}>{result.adjustedXp}</b> <span className="text-zinc-500">({Math.round((result.adjustedXp / result.budgetXp) * 100)}% del budget)</span></span>
            {result.difficulty && <span>Difficoltà: <b className="text-zinc-200">{DIFFICULTY_LABELS[result.difficulty]}</b></span>}
            {result.environment && <span>Ambiente: <b className="text-zinc-200">{ENVIRONMENT_LABELS[result.environment]}</b></span>}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {groupCreatures(result.creatures).map(({ creature: c, count }) => (
              <Link key={c.id} to={`/creature/${c.id}`} className="card group relative overflow-hidden">
                {count > 1 && (
                  <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white shadow">×{count}</span>
                )}
                <EntityImage src={c.image_url} name={c.name} kind={c.type} className="h-28 w-full object-cover" />
                <div className="p-2">
                  <p className="truncate text-sm font-medium group-hover:text-amber-300">{count > 1 ? `${count}× ` : ''}{c.name}</p>
                  <p className="text-xs text-zinc-400">GS {cr(c.cr)} · {TYPE_LABELS[c.type] || c.type} · {c.xp} PE{count > 1 ? ` l'una` : ''}</p>
                </div>
              </Link>
            ))}
          </div>

          {result.narrative && (
            <div className="card mt-4 border-l-2 border-l-amber-600/60 p-4">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-amber-300">Spunto di scena</h3>
              <p className="mt-1 text-sm italic leading-relaxed text-zinc-300">{result.narrative}</p>
            </div>
          )}

          {result.rewards && (
            <div className="card mt-4 p-4">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-amber-300">Ricompense</h3>
              <p className="mt-1 text-sm text-zinc-300">
                <span className="font-semibold text-amber-200">{result.rewards.gold_gp} mo</span> in monete e preziosi
                {result.rewards.items.length > 0 ? ', più:' : '.'}
              </p>
              {result.rewards.items.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {result.rewards.items.map((it) => (
                    <Link key={it.id} to={`/oggetti/${it.id}`} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-2 py-1.5 hover:border-amber-500/40">
                      <EntityImage src={it.image_url} name={it.name} kind={it.category} className="h-9 w-9 flex-shrink-0 rounded object-cover" />
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{it.name}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] text-white ${RARITY_COLORS[it.rarity] || 'bg-zinc-600'}`}>
                        {RARITY_LABELS[it.rarity] || it.rarity}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
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
