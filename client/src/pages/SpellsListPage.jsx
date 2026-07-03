import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { SPELL_SCHOOL_LABELS, SPELL_SCHOOL_COLORS, SPELL_CLASS_LABELS, spellLevel } from '../i18n';

const PAGE_SIZE = 24;

export default function SpellsListPage() {
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ search: '', level: '', school: '', klass: '', ritual: '', concentration: '', sort: 'level_asc' });
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
    api.spells(params).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
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
        <h1 className="font-display text-2xl font-bold text-amber-300">Incantesimi ({data.total})</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3 md:grid-cols-6">
        <input
          className="input col-span-2 sm:col-span-1 md:col-span-2"
          placeholder="Cerca per nome o testo..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
        <select className="input" value={filters.level} onChange={(e) => setFilter('level', e.target.value)}>
          <option value="">Tutti i livelli</option>
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i} value={i}>{spellLevel(i)}</option>
          ))}
        </select>
        <select className="input" value={filters.school} onChange={(e) => setFilter('school', e.target.value)}>
          <option value="">Tutte le scuole</option>
          {meta?.spellSchools?.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="input" value={filters.klass} onChange={(e) => setFilter('klass', e.target.value)}>
          <option value="">Tutte le classi</option>
          {meta?.spellClasses?.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className="input" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
          <option value="level_asc">Livello crescente</option>
          <option value="level_desc">Livello decrescente</option>
          <option value="name_asc">Nome A-Z</option>
          <option value="name_desc">Nome Z-A</option>
        </select>
        <div className="col-span-2 flex items-center gap-4 text-sm text-zinc-300 sm:col-span-3 md:col-span-6">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={filters.ritual === '1'} onChange={(e) => setFilter('ritual', e.target.checked ? '1' : '')} className="accent-amber-500" />
            Solo rituali
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={filters.concentration === '1'} onChange={(e) => setFilter('concentration', e.target.checked ? '1' : '')} className="accent-amber-500" />
            Solo concentrazione
          </label>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      ) : error ? (
        <p className="text-red-400">Errore nel caricamento degli incantesimi: {error}. Verifica l'indirizzo del server in Impostazioni.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.results.map((s) => (
            <Link
              key={s.id}
              to={`/incantesimi/${s.id}`}
              className="card group relative overflow-hidden p-4"
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${SPELL_SCHOOL_COLORS[s.school] || 'bg-zinc-600'}`} />
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-semibold leading-snug text-zinc-100 group-hover:text-amber-300">{s.name}</p>
                <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] text-zinc-300">
                  {spellLevel(s.level)}
                </span>
              </div>
              <p className="mt-0.5 text-xs italic text-zinc-400">
                {SPELL_SCHOOL_LABELS[s.school] || s.school}
                {s.ritual ? ' · rituale' : ''}
              </p>
              <p className="mt-2 line-clamp-1 text-xs text-zinc-500">
                {s.casting_time} · {s.range} · {s.duration}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.concentration && <span className="rounded bg-purple-900/50 px-1.5 py-0.5 text-[10px] text-purple-300">Concentrazione</span>}
                {(s.classes || []).map((c) => (
                  <span key={c} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">{SPELL_CLASS_LABELS[c] || c}</span>
                ))}
              </div>
            </Link>
          ))}
          {data.results.length === 0 && <p className="col-span-full text-zinc-400">Nessun incantesimo trovato con questi filtri.</p>}
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
