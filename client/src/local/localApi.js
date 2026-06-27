// Fully offline implementation of the same interface as ../api.js, backed
// by the embedded SRD dataset (src/data/*.json) plus homebrew entries
// persisted in localStorage. Used when running as a native Android app
// (see ../api.js platform detection) so the app needs no server at all.
import SRD_CREATURES from '../data/creatures.json';
import SRD_ITEMS from '../data/items.json';
import { homebrewStore } from './homebrewStore';
import { queryCreatures, queryItems } from './query';
import { generateEncounter, generateShop } from './generators';
import { ENVIRONMENT_LABELS, RARITY_LABELS } from '../i18n';
import { PROFESSIONS } from './professions';

function allCreatures() {
  return [...SRD_CREATURES, ...homebrewStore.getCreatures()];
}
function allItems() {
  return [...SRD_ITEMS, ...homebrewStore.getItems()];
}
function distinct(values) {
  return [...new Set(values)].sort();
}

export const localApi = {
  async meta() {
    const creatures = allCreatures();
    const items = allItems();
    return {
      environments: Object.keys(ENVIRONMENT_LABELS),
      creatureTypes: distinct(creatures.map((c) => c.type)),
      itemCategories: distinct(items.map((it) => it.category)),
      sizes: distinct(creatures.map((c) => c.size)),
      rarities: Object.keys(RARITY_LABELS).map((key) => ({ key, label: RARITY_LABELS[key] })),
      professions: Object.entries(PROFESSIONS).map(([key, p]) => ({ key, label: p.label })),
    };
  },

  async creatures(params) {
    return queryCreatures(allCreatures(), params);
  },
  async creature(id) {
    const found = allCreatures().find((c) => c.id === id);
    if (!found) throw new Error('Creatura non trovata');
    return found;
  },
  async createCreature(data) {
    return homebrewStore.createCreature(data);
  },
  async updateCreature(id, data) {
    return homebrewStore.updateCreature(id, data);
  },
  async deleteCreature(id) {
    homebrewStore.deleteCreature(id);
  },

  async items(params) {
    return queryItems(allItems(), params);
  },
  async item(id) {
    const found = allItems().find((it) => it.id === id);
    if (!found) throw new Error('Oggetto non trovato');
    return found;
  },
  async createItem(data) {
    return homebrewStore.createItem(data);
  },
  async updateItem(id, data) {
    return homebrewStore.updateItem(id, data);
  },
  async deleteItem(id) {
    homebrewStore.deleteItem(id);
  },

  async generateEncounter(data) {
    return generateEncounter(allCreatures(), data);
  },
  async generateShop(data) {
    return generateShop(allItems(), data);
  },
};
