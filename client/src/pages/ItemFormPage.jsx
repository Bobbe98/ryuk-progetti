import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { CATEGORY_LABELS, RARITY_LABELS } from '../i18n';

const EMPTY = {
  name: '', category: 'Wondrous Items', rarity: 'common', cost_gp: 50, attunement: false,
  weight: '', description: '', image_url: '',
  crafting_materials: '', crafting_procedure: '',
};

export default function ItemFormPage({ editMode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);

  useEffect(() => {
    if (editMode && id) {
      api.item(id).then((it) => {
        setForm({
          ...it,
          weight: it.weight ?? '',
          crafting_materials: (it.crafting_materials || []).join('\n'),
        });
      }).catch((e) => setError(e.message));
    }
  }, [editMode, id]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      cost_gp: Number(form.cost_gp),
      weight: form.weight === '' ? null : Number(form.weight),
      crafting_materials: form.crafting_materials.split('\n').map((l) => l.trim()).filter(Boolean),
    };
    try {
      if (editMode) {
        await api.updateItem(id, payload);
        navigate(`/oggetti/${id}`);
      } else {
        const created = await api.createItem(payload);
        navigate(`/oggetti/${created.id}`);
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/oggetti" className="text-sm text-amber-400">&larr; Torna agli oggetti</Link>
      <h1 className="font-display mt-3 text-2xl font-bold text-amber-300">{editMode ? 'Modifica oggetto homebrew' : 'Nuovo oggetto homebrew'}</h1>

      {error && <p className="mt-3 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Row>
          <Field label="Nome"><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <Field label="Immagine (URL)"><input className="input" value={form.image_url || ''} onChange={(e) => set('image_url', e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Categoria">
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {(meta?.itemCategories || Object.keys(CATEGORY_LABELS)).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
            </select>
          </Field>
          <Field label="Rarità">
            <select className="input" value={form.rarity} onChange={(e) => set('rarity', e.target.value)}>
              {(meta?.rarities || Object.entries(RARITY_LABELS).map(([key, label]) => ({ key, label }))).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Costo (mo)"><input type="number" className="input" value={form.cost_gp} onChange={(e) => set('cost_gp', e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Peso (lb)"><input type="number" className="input" value={form.weight} onChange={(e) => set('weight', e.target.value)} /></Field>
          <Field label="Richiede sintonia">
            <select className="input" value={form.attunement ? '1' : '0'} onChange={(e) => set('attunement', e.target.value === '1')}>
              <option value="0">No</option>
              <option value="1">Sì</option>
            </select>
          </Field>
        </Row>

        <Field label="Descrizione">
          <textarea className="input min-h-24" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <Field label="Materiali di creazione (uno per riga)">
          <textarea className="input min-h-20" value={form.crafting_materials} onChange={(e) => set('crafting_materials', e.target.value)} placeholder="Lega d'argento purissima&#10;Gemma focalizzante" />
        </Field>
        <Field label="Procedura di creazione">
          <textarea className="input min-h-20" value={form.crafting_procedure} onChange={(e) => set('crafting_procedure', e.target.value)} placeholder="Lasciare vuoto per generare automaticamente una procedura in base a categoria e rarità." />
        </Field>

        <button disabled={saving} type="submit" className="rounded bg-amber-600 px-5 py-2 font-semibold hover:bg-amber-500 disabled:opacity-50">
          {saving ? 'Salvataggio...' : 'Salva oggetto'}
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
