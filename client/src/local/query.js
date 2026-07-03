// In-memory equivalents of the SQL filter/sort/paginate logic in
// server/src/routes/creatures.js and items.js, run over the combined
// SRD + homebrew arrays when the app has no server to talk to.

function paginate(rows, page, pageSize) {
  const limit = Math.min(100, Math.max(1, Number(pageSize) || 24));
  const p = Math.max(1, Number(page) || 1);
  const offset = (p - 1) * limit;
  return { total: rows.length, page: p, pageSize: limit, results: rows.slice(offset, offset + limit) };
}

const CREATURE_SORTS = {
  cr_asc: (a, b) => a.cr - b.cr || a.name.localeCompare(b.name),
  cr_desc: (a, b) => b.cr - a.cr || a.name.localeCompare(b.name),
  name_asc: (a, b) => a.name.localeCompare(b.name),
  name_desc: (a, b) => b.name.localeCompare(a.name),
  hp_asc: (a, b) => a.hp - b.hp,
  hp_desc: (a, b) => b.hp - a.hp,
};

export function queryCreatures(all, params = {}) {
  const { search, type, environment, source, crMin, crMax, sort, page, pageSize } = params;
  let rows = all;
  if (search) {
    const needle = String(search).toLowerCase();
    rows = rows.filter((c) => c.name.toLowerCase().includes(needle) || (c.description || '').toLowerCase().includes(needle));
  }
  if (type) rows = rows.filter((c) => c.type === type);
  if (source) rows = rows.filter((c) => c.source === source);
  if (environment) rows = rows.filter((c) => (c.environments || []).includes(environment));
  if (crMin !== undefined && crMin !== '') rows = rows.filter((c) => c.cr >= Number(crMin));
  if (crMax !== undefined && crMax !== '') rows = rows.filter((c) => c.cr <= Number(crMax));

  rows = [...rows].sort(CREATURE_SORTS[sort] || CREATURE_SORTS.cr_asc);
  return paginate(rows, page, pageSize);
}

const SPELL_SORTS = {
  level_asc: (a, b) => a.level - b.level || a.name.localeCompare(b.name),
  level_desc: (a, b) => b.level - a.level || a.name.localeCompare(b.name),
  name_asc: (a, b) => a.name.localeCompare(b.name),
  name_desc: (a, b) => b.name.localeCompare(a.name),
};

export function querySpells(all, params = {}) {
  const { search, level, school, klass, ritual, concentration, sort, page, pageSize } = params;
  let rows = all;
  if (search) {
    const needle = String(search).toLowerCase();
    rows = rows.filter((s) => s.name.toLowerCase().includes(needle) || (s.description || '').toLowerCase().includes(needle));
  }
  if (level !== undefined && level !== '') rows = rows.filter((s) => s.level === Number(level));
  if (school) rows = rows.filter((s) => s.school === school);
  if (klass) rows = rows.filter((s) => (s.classes || []).includes(klass));
  if (ritual === '1') rows = rows.filter((s) => s.ritual);
  if (concentration === '1') rows = rows.filter((s) => s.concentration);

  rows = [...rows].sort(SPELL_SORTS[sort] || SPELL_SORTS.level_asc);
  return paginate(rows, page, pageSize);
}

const ITEM_SORTS = {
  rarity_asc: (a, b) => a.rarity_rank - b.rarity_rank || a.name.localeCompare(b.name),
  rarity_desc: (a, b) => b.rarity_rank - a.rarity_rank || a.name.localeCompare(b.name),
  name_asc: (a, b) => a.name.localeCompare(b.name),
  name_desc: (a, b) => b.name.localeCompare(a.name),
  cost_asc: (a, b) => a.cost_gp - b.cost_gp,
  cost_desc: (a, b) => b.cost_gp - a.cost_gp,
};

export function queryItems(all, params = {}) {
  const { search, category, rarity, source, sort, page, pageSize } = params;
  let rows = all;
  if (search) {
    const needle = String(search).toLowerCase();
    rows = rows.filter((it) => it.name.toLowerCase().includes(needle) || (it.description || '').toLowerCase().includes(needle));
  }
  if (category) rows = rows.filter((it) => it.category === category);
  if (rarity) rows = rows.filter((it) => it.rarity === rarity);
  if (source) rows = rows.filter((it) => it.source === source);

  rows = [...rows].sort(ITEM_SORTS[sort] || ITEM_SORTS.rarity_desc);
  return paginate(rows, page, pageSize);
}
