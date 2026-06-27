// On-device persistence for homebrew creatures/items when running fully
// offline (Android app). Mirrors the shape produced by the server's
// rowToCreature/rowToItem so the same UI components work unmodified.
import { generateCrafting } from './crafting';
import { RARITY_RANK } from './pricing';

const CREATURES_KEY = 'dnd5e-homebrew-creatures';
const ITEMS_KEY = 'dnd5e-homebrew-items';

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function newId() {
  return `hb-${crypto.randomUUID()}`;
}

function creatureFromBody(body) {
  return {
    name: body.name,
    source: 'homebrew',
    size: body.size || 'Media',
    type: body.type || 'humanoid',
    subtype: body.subtype || null,
    alignment: body.alignment || 'neutrale',
    ac: Number(body.ac) || 10,
    ac_detail: body.ac_detail || [],
    hp: Number(body.hp) || 1,
    hit_dice: body.hit_dice || '',
    speed: body.speed || { walk: '30 ft.' },
    str: Number(body.str) || 10, dex: Number(body.dex) || 10, con: Number(body.con) || 10,
    intl: Number(body.intl) || 10, wis: Number(body.wis) || 10, cha: Number(body.cha) || 10,
    saving_throws: body.saving_throws || {},
    skills: body.skills || {},
    damage_vulnerabilities: body.damage_vulnerabilities || [],
    damage_resistances: body.damage_resistances || [],
    damage_immunities: body.damage_immunities || [],
    condition_immunities: body.condition_immunities || [],
    senses: body.senses || {},
    languages: body.languages || '',
    cr: Number(body.cr) || 0,
    xp: Number(body.xp) || 0,
    proficiency_bonus: Number(body.proficiency_bonus) || 2,
    traits: body.traits || [],
    actions: body.actions || [],
    legendary_actions: body.legendary_actions || [],
    reactions: body.reactions || [],
    environments: body.environments || [],
    image_url: body.image_url || null,
    description: body.description || '',
  };
}

function itemFromBody(body) {
  const rarity = body.rarity || 'common';
  let craftingMaterials = body.crafting_materials;
  let craftingProcedure = body.crafting_procedure;
  if (!craftingMaterials || craftingMaterials.length === 0 || !craftingProcedure) {
    const generated = generateCrafting(body.category, rarity, body.name);
    craftingMaterials = craftingMaterials && craftingMaterials.length ? craftingMaterials : generated.crafting_materials;
    craftingProcedure = craftingProcedure || generated.crafting_procedure;
  }
  return {
    name: body.name,
    source: 'homebrew',
    category: body.category || 'Wondrous Items',
    rarity,
    rarity_rank: RARITY_RANK[rarity] ?? 0,
    cost_gp: Number(body.cost_gp) || 0,
    attunement: !!body.attunement,
    weight: body.weight != null && body.weight !== '' ? Number(body.weight) : null,
    description: body.description || '',
    properties: body.properties || {},
    crafting_materials: craftingMaterials,
    crafting_procedure: craftingProcedure,
    image_url: body.image_url || null,
  };
}

export const homebrewStore = {
  getCreatures() {
    return readList(CREATURES_KEY);
  },
  createCreature(body) {
    if (!body?.name) throw new Error('Il nome è obbligatorio');
    const row = { id: newId(), ...creatureFromBody(body) };
    const list = readList(CREATURES_KEY);
    list.push(row);
    writeList(CREATURES_KEY, list);
    return row;
  },
  updateCreature(id, body) {
    const list = readList(CREATURES_KEY);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Solo le creature homebrew possono essere modificate');
    const row = { id, ...creatureFromBody({ ...list[idx], ...body }) };
    list[idx] = row;
    writeList(CREATURES_KEY, list);
    return row;
  },
  deleteCreature(id) {
    const list = readList(CREATURES_KEY);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Solo le creature homebrew possono essere eliminate');
    list.splice(idx, 1);
    writeList(CREATURES_KEY, list);
  },

  getItems() {
    return readList(ITEMS_KEY);
  },
  createItem(body) {
    if (!body?.name) throw new Error('Il nome è obbligatorio');
    const row = { id: newId(), ...itemFromBody(body) };
    const list = readList(ITEMS_KEY);
    list.push(row);
    writeList(ITEMS_KEY, list);
    return row;
  },
  updateItem(id, body) {
    const list = readList(ITEMS_KEY);
    const idx = list.findIndex((it) => it.id === id);
    if (idx === -1) throw new Error('Solo gli oggetti homebrew possono essere modificati');
    const row = { id, ...itemFromBody({ ...list[idx], ...body }) };
    list[idx] = row;
    writeList(ITEMS_KEY, list);
    return row;
  },
  deleteItem(id) {
    const list = readList(ITEMS_KEY);
    const idx = list.findIndex((it) => it.id === id);
    if (idx === -1) throw new Error('Solo gli oggetti homebrew possono essere eliminati');
    list.splice(idx, 1);
    writeList(ITEMS_KEY, list);
  },
};
