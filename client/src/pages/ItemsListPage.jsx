import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import EntityImage from '../components/EntityImage';
import { applyOverrides } from '../local/overridesStore';
import { CATEGORY_LABELS, RARITY_LABELS, RARITY_COLORS } from '../i18n';

const PAGE_SIZE = 24;

export default function ItemsListPage() {
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: '', rarity: '', sort: 'rarity_desc' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ results: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = Object.fromEntries(Object.entries({ ...filters, page, pageSize: PAGE_SIZE }).filter(([, v]) => v !== ''));
    api.items(params).then((d) => setData({ ...d, results: applyOverrides('item', d.results) })).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key, value) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-amber-300">Oggetti ({data.total})</h1>
        <Link to="/oggetti/nuovo" className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-500">
          + Nuovo oggetto homebrew
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-4">
        <input
          className="col-span-2 rounded bg-black/30 px-3 py-2 text-sm"
          placeholder="Cerca per nome..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
        <select className="rounded bg-black/30 px-3 py-2 text-sm" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">Tutte le categorie</option>
          {meta?.itemCategories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
        <select className="rounded bg-black/30 px-3 py-2 text-sm" value={filters.rarity} onChange={(e) => setFilter('rarity', e.target.value)}>
          <option value="">Tutte le rarità</option>
          {meta?.rarities.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <select className="rounded bg-black/30 px-3 py-2 text-sm" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
          <option value="rarity_desc">Rarità decrescente</option>
          <option value="rarity_asc">Rarità crescente</option>
          <option value="cost_desc">Costo decrescente</option>
          <option value="cost_asc">Costo crescente</option>
          <option value="name_asc">Nome A-Z</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)}
        </div>
      ) : error ? (
        <p className="text-red-400">Errore nel caricamento degli oggetti: {error}. Verifica l'indirizzo del server in Impostazioni.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.results.map((it) => (
            <Link key={it.id} to={`/oggetti/${it.id}`} className="card group overflow-hidden">
              <EntityImage src={it.image_url} name={it.name} kind={it.category} className="h-28 w-full object-cover" />
              <div className="p-2">
                <p className="truncate text-sm font-medium group-hover:text-amber-300">{it.name}</p>
                <p className="text-xs text-zinc-400">{Math.round(it.cost_gp)} mo</p>
                <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] text-white ${RARITY_COLORS[it.rarity] || 'bg-zinc-600'}`}>
                  {RARITY_LABELS[it.rarity] || it.rarity}
                </span>
                {it.source === 'homebrew' && <span className="ml-1 inline-block rounded bg-amber-700/40 px-1.5 py-0.5 text-[10px] text-amber-300">Homebrew</span>}
              </div>
            </Link>
          ))}
          {data.results.length === 0 && <p className="col-span-full text-zinc-400">Nessun oggetto trovato con questi filtri.</p>}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded bg-white/10 px-3 py-1 disabled:opacity-30">←</button>
          <span>Pagina {page} di {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded bg-white/10 px-3 py-1 disabled:opacity-30">→</button>
        </div>
      )}
    </div>
  );
}
