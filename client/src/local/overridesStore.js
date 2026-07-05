// User customizations (description and/or image) applied on top of SRD
// entries — creatures, items and spells — stored on the device. This keeps
// the original data intact (removing the override restores it) and works
// identically in the web build and in the offline Android app.

const KEY = 'dnd5e-srd-overrides-v1';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') return { creature: {}, item: {}, spell: {}, ...raw };
  } catch { /* corrupted -> reset */ }
  return { creature: {}, item: {}, spell: {} };
}

let state = load();

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export const overridesStore = {
  get(kind, id) {
    return state[kind]?.[id] || null;
  },
  set(kind, id, patch) {
    const cur = { ...(state[kind]?.[id] || {}) };
    for (const field of ['description', 'image_url']) {
      if (!(field in patch)) continue;
      const v = patch[field];
      if (v === null || v === undefined || v === '') delete cur[field];
      else cur[field] = v;
    }
    const kindMap = { ...state[kind] };
    if (Object.keys(cur).length === 0) delete kindMap[id];
    else kindMap[id] = cur;
    state = { ...state, [kind]: kindMap };
    persist();
  },
  clear(kind, id) {
    if (!state[kind]?.[id]) return;
    const kindMap = { ...state[kind] };
    delete kindMap[id];
    state = { ...state, [kind]: kindMap };
    persist();
  },
};

export function applyOverride(kind, row) {
  if (!row) return row;
  const o = overridesStore.get(kind, row.id);
  return o ? { ...row, ...o, customized: true } : row;
}

export function applyOverrides(kind, rows) {
  return (rows || []).map((r) => applyOverride(kind, r));
}
