import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { ENVIRONMENT_LABELS } from '../i18n';

const EMPTY = {
  name: '', size: 'Media', type: 'humanoid', subtype: '', alignment: 'neutrale',
  ac: 12, hp: 10, hit_dice: '2d8+2', languages: 'Comune',
  str: 10, dex: 10, con: 10, intl: 10, wis: 10, cha: 10,
  cr: 0.25, xp: 50, proficiency_bonus: 2,
  description: '', image_url: '',
  environments: [],
  traitsText: '', actionsText: '',
};

function listToText(list) {
  return (list || []).map((t) => `${t.name}|${t.desc}`).join('\n');
}
function textToList(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [name, ...rest] = line.split('|');
    return { name: (name || '').trim(), desc: rest.join('|').trim() };
  });
}

export default function CreatureFormPage({ editMode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);

  useEffect(() => {
    if (editMode && id) {
      api.creature(id).then((c) => {
        setForm({
          ...c,
          traitsText: listToText(c.traits),
          actionsText: listToText(c.actions),
        });
      }).catch((e) => setError(e.message));
    }
  }, [editMode, id]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleEnv(env) {
    setForm((f) => ({
      ...f,
      environments: f.environments.includes(env) ? f.environments.filter((e) => e !== env) : [...f.environments, env],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      ac: Number(form.ac), hp: Number(form.hp), cr: Number(form.cr), xp: Number(form.xp),
      str: Number(form.str), dex: Number(form.dex), con: Number(form.con),
      intl: Number(form.intl), wis: Number(form.wis), cha: Number(form.cha),
      traits: textToList(form.traitsText),
      actions: textToList(form.actionsText),
    };
    try {
      if (editMode) {
        await api.updateCreature(id, payload);
        navigate(`/creature/${id}`);
      } else {
        const created = await api.createCreature(payload);
        navigate(`/creature/${created.id}`);
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/creature" className="text-sm text-amber-400">&larr; Torna al bestiario</Link>
      <h1 className="mt-3 text-2xl font-bold text-amber-300">{editMode ? 'Modifica creatura homebrew' : 'Nuova creatura homebrew'}</h1>

      {error && <p className="mt-3 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Row>
          <Field label="Nome"><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <Field label="Immagine (URL)"><input className="input" value={form.image_url || ''} onChange={(e) => set('image_url', e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Taglia">
            <select className="input" value={form.size} onChange={(e) => set('size', e.target.value)}>
              {['Minuscola', 'Piccola', 'Media', 'Grande', 'Enorme', 'Mastodontica'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <input className="input" value={form.type} onChange={(e) => set('type', e.target.value)} placeholder="es. umanoide" />
          </Field>
          <Field label="Sottotipo"><input className="input" value={form.subtype || ''} onChange={(e) => set('subtype', e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Allineamento"><input className="input" value={form.alignment} onChange={(e) => set('alignment', e.target.value)} /></Field>
          <Field label="Linguaggi"><input className="input" value={form.languages} onChange={(e) => set('languages', e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Classe Armatura"><input type="number" className="input" value={form.ac} onChange={(e) => set('ac', e.target.value)} /></Field>
          <Field label="Punti Ferita"><input type="number" className="input" value={form.hp} onChange={(e) => set('hp', e.target.value)} /></Field>
          <Field label="Dadi Vita"><input className="input" value={form.hit_dice} onChange={(e) => set('hit_dice', e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Grado di Sfida"><input type="number" step="0.125" className="input" value={form.cr} onChange={(e) => set('cr', e.target.value)} /></Field>
          <Field label="Punti Esperienza"><input type="number" className="input" value={form.xp} onChange={(e) => set('xp', e.target.value)} /></Field>
          <Field label="Bonus Competenza"><input type="number" className="input" value={form.proficiency_bonus} onChange={(e) => set('proficiency_bonus', e.target.value)} /></Field>
        </Row>
        <Row>
          {['str', 'dex', 'con', 'intl', 'wis', 'cha'].map((a) => (
            <Field key={a} label={a.toUpperCase()}><input type="number" className="input" value={form[a]} onChange={(e) => set(a, e.target.value)} /></Field>
          ))}
        </Row>

        <Field label="Descrizione / Comportamento">
          <textarea className="input min-h-24" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <Field label="Habitat">
          <div className="flex flex-wrap gap-2">
            {(meta?.environments || []).map((env) => (
              <button
                type="button" key={env} onClick={() => toggleEnv(env)}
                className={`rounded px-2 py-1 text-xs ${form.environments.includes(env) ? 'bg-emerald-700 text-white' : 'bg-white/10 text-zinc-300'}`}
              >
                {ENVIRONMENT_LABELS[env] || env}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Tratti (una riga per tratto: Nome|Descrizione)">
          <textarea className="input min-h-20" value={form.traitsText} onChange={(e) => set('traitsText', e.target.value)} placeholder="Anfibio|La creatura respira aria e acqua." />
        </Field>
        <Field label="Azioni (una riga per azione: Nome|Descrizione)">
          <textarea className="input min-h-20" value={form.actionsText} onChange={(e) => set('actionsText', e.target.value)} placeholder="Morso|Attacco con arma da mischia: +4 per colpire..." />
        </Field>

        <button disabled={saving} type="submit" className="rounded bg-amber-600 px-5 py-2 font-semibold hover:bg-amber-500 disabled:opacity-50">
          {saving ? 'Salvataggio...' : 'Salva creatura'}
        </button>
      </form>
    </div>
  );
}

function Row({ children }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}
function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
