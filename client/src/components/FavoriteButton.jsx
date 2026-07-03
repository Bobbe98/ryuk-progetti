import { useState, useSyncExternalStore } from 'react';
import { favoritesStore } from '../local/favoritesStore';

function useFavoritesState() {
  return useSyncExternalStore(
    (fn) => favoritesStore.subscribe(fn),
    () => favoritesStore.getSnapshot(),
  );
}

// Star toggle + "add to preparation list" menu, used on detail pages.
// kind: 'creature' | 'item' | 'spell'
export default function FavoriteButton({ kind, id, compact = false }) {
  const state = useFavoritesState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const fav = favoritesStore.isFavorite(kind, id);

  function createAndAdd(e) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const list = favoritesStore.createList(newListName);
    favoritesStore.toggleInList(list.id, kind, id);
    setNewListName('');
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => favoritesStore.toggleFavorite(kind, id)}
        aria-label={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
        title={fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
        className={`rounded-lg border px-2 py-1 text-lg leading-none transition ${
          fav
            ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
            : 'border-white/10 bg-white/5 text-zinc-400 hover:border-amber-500/40 hover:text-amber-300'
        }`}
      >
        {fav ? '★' : '☆'}
      </button>

      {!compact && (
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          title="Aggiungi a una lista"
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-400 transition hover:border-amber-500/40 hover:text-amber-300"
        >
          + Lista
        </button>
      )}

      {menuOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-white/15 bg-[#181420]/97 p-3 shadow-xl shadow-black/50 backdrop-blur">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Liste di preparazione</p>
          {state.lists.length === 0 && <p className="mb-2 text-xs text-zinc-500">Nessuna lista. Creane una qui sotto.</p>}
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {state.lists.map((l) => {
              const inList = favoritesStore.isInList(l.id, kind, id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => favoritesStore.toggleInList(l.id, kind, id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    inList ? 'bg-amber-500/15 text-amber-300' : 'text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{l.name}</span>
                  <span>{inList ? '✓' : '+'}</span>
                </button>
              );
            })}
          </div>
          <form onSubmit={createAndAdd} className="mt-2 flex gap-1.5">
            <input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Nuova lista..."
              className="input flex-1 !py-1.5"
            />
            <button type="submit" disabled={!newListName.trim()} className="rounded bg-amber-600 px-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-30">+</button>
          </form>
        </div>
      )}
    </div>
  );
}

export { useFavoritesState };
