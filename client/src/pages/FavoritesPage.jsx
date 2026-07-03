import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { favoritesStore } from '../local/favoritesStore';
import { useFavoritesState } from '../components/FavoriteButton';

const KIND_LABELS = { creature: 'Creatura', item: 'Oggetto', spell: 'Incantesimo' };
const KIND_ROUTES = { creature: '/creature', item: '/oggetti', spell: '/incantesimi' };
const KIND_COLORS = { creature: 'bg-emerald-900/50 text-emerald-300', item: 'bg-blue-900/50 text-blue-300', spell: 'bg-violet-900/50 text-violet-300' };

function fetchEntry(entry) {
  const fn = { creature: api.creature, item: api.item, spell: api.spell }[entry.kind];
  return fn ? fn(entry.id) : Promise.reject(new Error('tipo sconosciuto'));
}

function useResolvedNames(entries) {
  const [names, setNames] = useState({});
  const key = useMemo(() => entries.map((e) => `${e.kind}:${e.id}`).join('|'), [entries]);

  useEffect(() => {
    let alive = true;
    const missing = entries.filter((e) => !(`${e.kind}:${e.id}` in names));
    if (missing.length === 0) return;
    Promise.allSettled(missing.map((e) => fetchEntry(e))).then((results) => {
      if (!alive) return;
      setNames((prev) => {
        const next = { ...prev };
        results.forEach((r, i) => {
          const k = `${missing[i].kind}:${missing[i].id}`;
          next[k] = r.status === 'fulfilled' ? r.value.name : '(non trovato)';
        });
        return next;
      });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return names;
}

function EntryRow({ entry, name, onRemove }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
      <Link to={`${KIND_ROUTES[entry.kind]}/${entry.id}`} className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-amber-300">
        {name || '...'}
      </Link>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${KIND_COLORS[entry.kind]}`}>{KIND_LABELS[entry.kind]}</span>
      <button onClick={onRemove} title="Rimuovi" className="shrink-0 rounded px-1.5 text-zinc-500 transition hover:bg-red-900/40 hover:text-red-300">✕</button>
    </div>
  );
}

export default function FavoritesPage() {
  const state = useFavoritesState();
  const [newListName, setNewListName] = useState('');
  const allEntries = useMemo(
    () => [...state.favorites, ...state.lists.flatMap((l) => l.entries)],
    [state],
  );
  const names = useResolvedNames(allEntries);

  function createList(e) {
    e.preventDefault();
    if (!newListName.trim()) return;
    favoritesStore.createList(newListName);
    setNewListName('');
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-amber-300">Preferiti e liste</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Le stelle e le liste di preparazione sono salvate su questo dispositivo: raccogli creature, oggetti e incantesimi per la prossima sessione.
      </p>

      <div className="card mt-6 p-5">
        <h2 className="font-display text-lg font-semibold text-amber-200">★ Preferiti ({state.favorites.length})</h2>
        {state.favorites.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Nessun preferito. Apri una creatura, un oggetto o un incantesimo e tocca la stella.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {state.favorites.map((e) => (
              <EntryRow
                key={`${e.kind}:${e.id}`}
                entry={e}
                name={names[`${e.kind}:${e.id}`]}
                onRemove={() => favoritesStore.toggleFavorite(e.kind, e.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-amber-200">Liste di preparazione</h2>
        <form onSubmit={createList} className="flex gap-2">
          <input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Es. Sessione di sabato"
            className="input w-56"
          />
          <button type="submit" disabled={!newListName.trim()} className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-30">
            + Crea lista
          </button>
        </form>
      </div>

      {state.lists.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500">
          Nessuna lista. Creane una qui sopra, poi aggiungi elementi dalle pagine di dettaglio con il pulsante «+ Lista».
        </p>
      )}

      <div className="mt-3 space-y-4">
        {state.lists.map((l) => (
          <div key={l.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                defaultValue={l.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== l.name && favoritesStore.renameList(l.id, e.target.value)}
                className="rounded border border-transparent bg-transparent px-1 font-display text-lg font-semibold text-zinc-100 outline-none transition focus:border-amber-500/50 focus:bg-black/30"
              />
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>{l.entries.length} elementi</span>
                <button
                  onClick={() => confirm(`Eliminare la lista "${l.name}"?`) && favoritesStore.deleteList(l.id)}
                  className="rounded bg-red-900/40 px-2 py-1 text-red-300 transition hover:bg-red-800/50"
                >
                  Elimina lista
                </button>
              </div>
            </div>
            {l.entries.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Lista vuota.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {l.entries.map((e) => (
                  <EntryRow
                    key={`${e.kind}:${e.id}`}
                    entry={e}
                    name={names[`${e.kind}:${e.id}`]}
                    onRemove={() => favoritesStore.toggleInList(l.id, e.kind, e.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
