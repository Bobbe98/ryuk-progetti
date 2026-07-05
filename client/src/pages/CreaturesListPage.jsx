import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import EntityImage from '../components/EntityImage';
import { applyOverrides } from '../local/overridesStore';
import { TYPE_LABELS, ENVIRONMENT_LABELS, cr } from '../i18n';

const PAGE_SIZE = 24;

export default function CreaturesListPage() {
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', type: '', environment: '', crMin: '', crMax: '', sort: 'cr_asc' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ results: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = Object.fromEntries(Object.entries({ ...filters, page, pageSize: PAGE_SIZE }).filter(([, v]) => v !== ''));
    api.creatures(params).then((d) => setData({ ...d, results: applyOverrides('creature', d.results) })).catch((e) => setError(e.message)).finally(() => setLoading(false));
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
        <h1 className="font-display text-2xl font-bold text-amber-300">Bestiario ({data.total})</h1>
        <Link to="/creature/nuova" className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold hover:bg-amber-500">
          + Nuova creatura homebrew
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-3 md:grid-cols-6">
        <input
          className="col-span-2 rounded bg-black/30 px-3 py-2 text-sm sm:col-span-1 md:col-span-2"
          placeholder="Cerca per nome..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
        <select className="rounded bg-black/30 px-3 py-2 text-sm" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
          <option value="">Tutti i tipi</option>
          {meta?.creatureTypes.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
        </select>
        <select className="rounded bg-black/30 px-3 py-2 text-sm" value={filters.environment} onChange={(e) => setFilter('environment', e.target.value)}>
          <option value="">Tutti gli habitat</option>
          {meta?.environments.map((e) => <option key={e} value={e}>{ENVIRONMENT_LABELS[e] || e}</option>)}
        </select>
        <input
          type="number" step="0.125" placeholder="GS min" className="rounded bg-black/30 px-3 py-2 text-sm"
          value={filters.crMin} onChange={(e) => setFilter('crMin', e.target.value)}
        />
        <input
          type="number" step="0.125" placeholder="GS max" className="rounded bg-black/30 px-3 py-2 text-sm"
          value={filters.crMax} onChange={(e) => setFilter('crMax', e.target.value)}
        />
        <select className="rounded bg-black/30 px-3 py-2 text-sm" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
          <option value="cr_asc">GS crescente</option>
          <option value="cr_desc">GS decrescente</option>
          <option value="name_asc">Nome A-Z</option>
          <option value="name_desc">Nome Z-A</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton h-44 rounded-xl" />)}
        </div>
      ) : error ? (
        <p className="text-red-400">Errore nel caricamento del bestiario: {error}. Verifica l'indirizzo del server in Impostazioni.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.results.map((c) => (
            <Link key={c.id} to={`/creature/${c.id}`} className="card group overflow-hidden">
              <EntityImage src={c.image_url} name={c.name} kind={c.type} className="h-28 w-full object-cover" />
              <div className="p-2">
                <p className="truncate text-sm font-medium group-hover:text-amber-300">{c.name}</p>
                <p className="text-xs text-zinc-400">GS {cr(c.cr)} · {TYPE_LABELS[c.type] || c.type}</p>
                {c.source === 'homebrew' && <span className="mt-1 inline-block rounded bg-amber-700/40 px-1.5 py-0.5 text-[10px] text-amber-300">Homebrew</span>}
              </div>
            </Link>
          ))}
          {data.results.length === 0 && <p className="col-span-full text-zinc-400">Nessuna creatura trovata con questi filtri.</p>}
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
