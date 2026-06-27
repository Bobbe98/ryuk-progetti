// Client-side ports of server/src/routes/encounters.js and shops.js, run
// over in-memory arrays instead of SQL queries for the fully-offline build.
import { xpForCr, partyXpBudget, monsterCountMultiplier } from './encounterBudget';
import { PROFESSIONS } from './professions';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateEncounter(allCreatures, payload = {}) {
  const { mode = 'cr', cr, environment, partyLevel, partySize, difficulty = 'medium', creatureCount } = payload;

  let budget;
  if (mode === 'party') {
    const lvl = Number(partyLevel) || 4;
    const size = Number(partySize) || 4;
    budget = partyXpBudget(lvl, size, difficulty);
  } else {
    const targetCr = cr === undefined || cr === null || cr === '' ? 1 : Number(cr);
    budget = xpForCr(targetCr);
  }

  const crCeiling = mode === 'party' ? 30 : Math.max(0.125, Number(cr) || 1) * 1.5 + 2;
  const pool = allCreatures.filter((c) => c.cr <= crCeiling && (!environment || (c.environments || []).includes(environment)));
  if (pool.length === 0) {
    throw new Error('Nessuna creatura trovata per i filtri selezionati (ambiente/GS).');
  }

  const desiredCount = creatureCount ? Math.max(1, Math.min(12, Number(creatureCount))) : null;
  const shuffled = shuffle(pool);

  const selected = [];
  let totalXp = 0;
  for (const creature of shuffled) {
    if (desiredCount && selected.length >= desiredCount) break;
    const candidateXp = totalXp + (creature.xp || xpForCr(creature.cr));
    const multiplier = monsterCountMultiplier(selected.length + 1);
    if (selected.length > 0 && candidateXp * multiplier > budget * 1.15 && !desiredCount) continue;
    selected.push(creature);
    totalXp = candidateXp;
    if (!desiredCount && totalXp * monsterCountMultiplier(selected.length) >= budget * 0.85) break;
    if (selected.length >= 8) break;
  }
  if (selected.length === 0) selected.push(shuffled[0]);

  const adjustedXp = totalXp * monsterCountMultiplier(selected.length);

  return {
    mode,
    environment: environment || null,
    budgetXp: Math.round(budget),
    totalXp: Math.round(totalXp),
    adjustedXp: Math.round(adjustedXp),
    creatures: selected,
  };
}

const NAME_NOUNS = [
  ['Forgia', 'La'], ['Calice', 'Il'], ['Lanterna', 'La'], ['Grifone', 'Il'], ['Drago', 'Il'],
  ['Crogiolo', 'Il'], ['Martello', 'Il'], ['Calderone', 'Il'], ['Stella', 'La'], ['Corvo', 'Il'],
  ['Ancora', "L'"], ['Quercia', 'La'], ['Falce', 'La'], ['Mantice', 'Il'], ['Scrigno', 'Lo'],
  ['Vento', 'Il'], ['Rubino', 'Il'], ['Incudine', "L'"], ['Civetta', 'La'],
];
const NAME_ADJ = [
  "d'Oro", 'Errante', 'Scarlatto', 'Incantato', "dell'Alba", 'Silenzioso', 'Antico', 'Fortunato',
  'Curioso', "del Crepuscolo", 'Sussurrante',
];

function randomShopName() {
  const [noun, article] = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  const adj = Math.random() > 0.3 ? ` ${NAME_ADJ[Math.floor(Math.random() * NAME_ADJ.length)]}` : '';
  return `${article}${article === "L'" ? '' : ' '}${noun}${adj}`;
}

function weightedRarity(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, w] of entries) {
    if (roll < w) return rarity;
    roll -= w;
  }
  return entries[0][0];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateShop(allItems, payload = {}) {
  const { profession, name } = payload;
  const config = PROFESSIONS[profession];
  if (!config) throw new Error('Mestiere non valido.');

  const stockCount = randInt(config.stockRange[0], config.stockRange[1]);
  const candidates = allItems.filter((it) => config.categories.includes(it.category));
  if (candidates.length === 0) {
    throw new Error('Nessun oggetto disponibile per questo mestiere.');
  }

  const byRarity = {};
  for (const it of candidates) {
    (byRarity[it.rarity] ||= []).push(it);
  }

  const stock = [];
  const usedIds = new Set();
  let attempts = 0;
  while (stock.length < stockCount && attempts < stockCount * 20) {
    attempts++;
    const rarity = weightedRarity(config.rarityWeights);
    const bucket = byRarity[rarity] || candidates;
    const item = bucket[Math.floor(Math.random() * bucket.length)];
    if (usedIds.has(item.id)) continue;
    usedIds.add(item.id);
    const markup = config.markup[0] + Math.random() * (config.markup[1] - config.markup[0]);
    const quantity = item.category === 'Adventuring Gear' || item.category === 'Ammunition' ? randInt(1, 8) : 1;
    stock.push({
      ...item,
      shop_price_gp: Math.max(1, Math.round((item.cost_gp || 1) * markup)),
      quantity,
    });
  }

  const totalValue = stock.reduce((s, it) => s + it.shop_price_gp * it.quantity, 0);

  return {
    name: name || randomShopName(),
    profession: config.label,
    professionKey: profession,
    totalValueGp: totalValue,
    stock,
  };
}
