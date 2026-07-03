// localStorage-backed favorites ("stella") and named preparation lists,
// available on every platform (web and offline Android alike).

const KEY = 'dnd5e-favorites-v1';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.favorites && raw.lists) return raw;
  } catch { /* corrupted -> reset */ }
  return { favorites: [], lists: [] }; // favorites: [{kind,id}], lists: [{id,name,entries:[{kind,id}]}]
}

let state = load();
const listeners = new Set();

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
  for (const fn of listeners) fn();
}

function sameEntry(a, b) {
  return a.kind === b.kind && a.id === b.id;
}

export const favoritesStore = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot() {
    return state;
  },

  isFavorite(kind, id) {
    return state.favorites.some((e) => sameEntry(e, { kind, id }));
  },
  toggleFavorite(kind, id) {
    const entry = { kind, id };
    const exists = this.isFavorite(kind, id);
    state = {
      ...state,
      favorites: exists
        ? state.favorites.filter((e) => !sameEntry(e, entry))
        : [...state.favorites, entry],
    };
    persist();
    return !exists;
  },

  createList(name) {
    const list = { id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: name.trim(), entries: [] };
    state = { ...state, lists: [...state.lists, list] };
    persist();
    return list;
  },
  renameList(listId, name) {
    state = { ...state, lists: state.lists.map((l) => (l.id === listId ? { ...l, name: name.trim() } : l)) };
    persist();
  },
  deleteList(listId) {
    state = { ...state, lists: state.lists.filter((l) => l.id !== listId) };
    persist();
  },
  isInList(listId, kind, id) {
    const list = state.lists.find((l) => l.id === listId);
    return !!list && list.entries.some((e) => sameEntry(e, { kind, id }));
  },
  toggleInList(listId, kind, id) {
    const entry = { kind, id };
    state = {
      ...state,
      lists: state.lists.map((l) => {
        if (l.id !== listId) return l;
        const exists = l.entries.some((e) => sameEntry(e, entry));
        return { ...l, entries: exists ? l.entries.filter((e) => !sameEntry(e, entry)) : [...l.entries, entry] };
      }),
    };
    persist();
  },
};
