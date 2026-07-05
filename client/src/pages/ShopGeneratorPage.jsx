import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import EntityImage from '../components/EntityImage';
import { applyOverrides } from '../local/overridesStore';
import { CATEGORY_LABELS, RARITY_LABELS, RARITY_COLORS } from '../i18n';

const RARITY_INPUTS = [
  ['common', 'Comuni'],
  ['uncommon', 'Non comuni'],
  ['rare', 'Rari'],
  ['very_rare', 'Molto rari'],
  ['legendary', 'Leggendari'],
  ['artifact', 'Artefatti'],
];

export default function ShopGeneratorPage() {
  const [meta, setMeta] = useState(null);
  const [profession, setProfession] = useState('');
  const [inventoryMode, setInventoryMode] = useState('auto'); // 'auto' | 'manual'
  const [counts, setCounts] = useState({ common: 6, uncommon: 3, rare: 2, very_rare: 1, legendary: 0, artifact: 0 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.meta().then((m) => {
      setMeta(m);
      if (m.professions?.length) setProfession(m.professions[0].key);
    }).catch(() => {});
  }, []);

  function setCount(rarity, value) {
    setCounts((c) => ({ ...c, [rarity]: value === '' ? '' : Math.max(0, Math.min(30, Number(value) || 0)) }));
  }

  async function generate() {
    if (!profession) return;
    setLoading(true);
    setError(null);
    try {
      const payload = { profession };
      if (inventoryMode === 'manual') payload.rarityCounts = counts;
      const data = await api.generateShop(payload);
      setResult({ ...data, stock: applyOverrides('item', data.stock) });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const totalManual = RARITY_INPUTS.reduce((s, [k]) => s + (Number(counts[k]) || 0), 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-amber-300">Generatore di negozi</h1>
      <p className="mt-1 text-sm text-zinc-400">Genera un negozio casuale con inventario coerente in base al mestiere del mercante.</p>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-400">Mestiere</span>
            <select className="input" value={profession} onChange={(e) => setProfession(e.target.value)}>
              {meta?.professions.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-400">Inventario</span>
            <select className="input" value={inventoryMode} onChange={(e) => setInventoryMode(e.target.value)}>
              <option value="auto">Automatico (per mestiere)</option>
              <option value="manual">Scegli quanti oggetti per rarità</option>
            </select>
          </label>
          <button onClick={generate} disabled={loading || (inventoryMode === 'manual' && totalManual === 0)} className="rounded bg-amber-600 px-5 py-2 font-semibold hover:bg-amber-500 disabled:opacity-50">
            {loading ? 'Generazione...' : 'Genera negozio'}
          </button>
        </div>

        {inventoryMode === 'manual' && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-2 text-xs text-zinc-500">
              Numero di oggetti per ogni rarità (0 = nessuno). Il generatore privilegia gli oggetti coerenti col mestiere e
              completa dal catalogo generale se non bastano.
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {RARITY_INPUTS.map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className={`mb-1 block rounded px-1.5 py-0.5 text-center text-xs text-white ${RARITY_COLORS[key]}`}>{label}</span>
                  <input
                    type="number" min="0" max="30" className="input text-center"
                    value={counts[key]}
                    onChange={(e) => setCount(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">{error}</p>}

      {result && (
        <div className="mt-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-amber-200">{result.name}</h2>
              <p className="text-sm text-zinc-400">{result.profession} · {result.stock.length} articoli</p>
            </div>
            <p className="text-sm text-zinc-400">Valore totale inventario: <b className="text-zinc-200">{result.totalValueGp} mo</b></p>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/10 text-left text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Oggetto</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Rarità</th>
                  <th className="px-3 py-2">Quantità</th>
                  <th className="px-3 py-2">Prezzo (mo)</th>
                </tr>
              </thead>
              <tbody>
                {result.stock.map((it) => (
                  <tr key={it.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2">
                      <Link to={`/oggetti/${it.id}`} className="flex items-center gap-2 text-amber-300 hover:underline">
                        <EntityImage src={it.image_url} name={it.name} kind={it.category} className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                        {it.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{CATEGORY_LABELS[it.category] || it.category}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs text-white ${RARITY_COLORS[it.rarity] || 'bg-zinc-600'}`}>
                        {RARITY_LABELS[it.rarity] || it.rarity}
                      </span>
                    </td>
                    <td className="px-3 py-2">{it.quantity}</td>
                    <td className="px-3 py-2">{it.shop_price_gp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
