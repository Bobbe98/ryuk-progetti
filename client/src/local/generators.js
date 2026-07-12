// Client-side ports of server/src/routes/encounters.js and shops.js, run
// over in-memory arrays instead of SQL queries for the fully-offline build.
import { xpForCr, partyXpBudget, monsterCountMultiplier } from './encounterBudget';
import { rewardPlan, narrativeSeed, shuffleArray } from './encounterExtras';
import { PROFESSIONS } from './professions';

function isLegendary(c) {
  return (c.legendary_actions || []).length > 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Balanced encounter builder (DMG method): the difficulty budget is compared
// against the ADJUSTED XP (base XP × multiplier for the number of monsters)
// at every step, so an encounter generated as "medium" really lands in the
// medium band. It tries many random compositions (boss, pair, small group,
// horde — duplicates allowed, like 4 goblins) and keeps the one whose
// adjusted XP is closest to the budget, never exceeding it by more than 10%.
function buildBalancedEncounter(pool, budget, desiredCount, opts = {}) {
  const { legendary = 'any' } = opts;
  let candidates = pool.filter((c) => (c.xp || 0) > 0 && c.xp <= budget * 1.05);
  if (legendary === 'exclude') candidates = candidates.filter((c) => !isLegendary(c));
  const legendaries = legendary === 'boss' ? candidates.filter((c) => isLegendary(c)) : [];

  if (candidates.length === 0) {
    const fallbackPool = legendary === 'exclude' ? pool.filter((c) => !isLegendary(c)) : pool;
    const weakest = [...fallbackPool].sort((a, b) => (a.xp || 0) - (b.xp || 0))[0];
    return weakest ? { selected: [weakest], totalXp: weakest.xp || 0 } : null;
  }

  const countChoices = desiredCount
    ? [Math.max(1, Math.min(12, desiredCount))]
    : [1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8];

  let best = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const n = countChoices[Math.floor(Math.random() * countChoices.length)];
    const idealXp = budget / (monsterCountMultiplier(n) * n);
    let band = candidates.filter((c) => c.xp >= idealXp * 0.5 && c.xp <= idealXp * 1.6);
    if (band.length === 0) {
      band = [...candidates]
        .sort((a, b) => Math.abs(Math.log(a.xp / idealXp)) - Math.abs(Math.log(b.xp / idealXp)))
        .slice(0, 8);
    }
    const selected = [];
    let totalXp = 0;

    if (legendaries.length > 0) {
      // Boss mode: the legendary takes the biggest share of the budget, the
      // remaining slots (if any) are filled with minions from the band.
      const bossBand = legendaries.filter((c) => c.xp >= idealXp * 0.5);
      const pickFrom = bossBand.length ? bossBand : legendaries;
      const boss = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      selected.push(boss);
      totalXp += boss.xp;
      const minionBand = band.filter((c) => c.xp <= boss.xp);
      for (let i = 1; i < n && minionBand.length; i++) {
        const c = minionBand[Math.floor(Math.random() * minionBand.length)];
        selected.push(c);
        totalXp += c.xp;
      }
    } else {
      const homogeneous = n > 1 && Math.random() < 0.55;
      const fixed = band[Math.floor(Math.random() * band.length)];
      for (let i = 0; i < n; i++) {
        const c = homogeneous ? fixed : band[Math.floor(Math.random() * band.length)];
        selected.push(c);
        totalXp += c.xp;
      }
    }

    const adjusted = totalXp * monsterCountMultiplier(selected.length);
    const ratio = adjusted / budget;
    let score = Math.abs(Math.log(ratio));
    if (ratio > 1.1) score += (ratio - 1.1) * 5;
    if (!best || score < best.score) best = { selected, totalXp, score };
    if (best.score < 0.04) break;
  }
  return { selected: best.selected, totalXp: best.totalXp };
}

export function generateEncounter(allCreatures, allItems, payload = {}) {
  const {
    mode = 'cr', cr, environment, creatureType, legendary = 'any',
    partyLevel, partySize, difficulty = 'medium', creatureCount,
  } = payload;

  let budget;
  if (mode === 'party') {
    const lvl = Number(partyLevel) || 4;
    const size = Number(partySize) || 4;
    budget = partyXpBudget(lvl, size, difficulty);
  } else {
    const targetCr = cr === undefined || cr === null || cr === '' ? 1 : Number(cr);
    budget = xpForCr(targetCr);
  }

  const pool = allCreatures.filter((c) =>
    (c.xp || 0) > 0
    && (!environment || (c.environments || []).includes(environment))
    && (!creatureType || c.type === creatureType));
  if (pool.length === 0) {
    throw new Error('Nessuna creatura trovata per i filtri selezionati (tipo/ambiente).');
  }

  const built = buildBalancedEncounter(pool, budget, creatureCount ? Number(creatureCount) : null, { legendary });
  const { selected, totalXp } = built;
  const adjustedXp = totalXp * monsterCountMultiplier(selected.length);

  const plan = rewardPlan(selected, budget);
  const rewardItems = shuffleArray(allItems.filter((it) => plan.band.includes(it.rarity))).slice(0, plan.itemCount);

  return {
    mode,
    difficulty: mode === 'party' ? difficulty : null,
    environment: environment || null,
    creatureType: creatureType || null,
    budgetXp: Math.round(budget),
    totalXp: Math.round(totalXp),
    adjustedXp: Math.round(adjustedXp),
    creatures: selected,
    narrative: narrativeSeed(),
    rewards: { gold_gp: plan.gold, items: rewardItems },
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

function priceAndQuantity(item, config) {
  const markup = config.markup[0] + Math.random() * (config.markup[1] - config.markup[0]);
  const quantity = item.category === 'Adventuring Gear' || item.category === 'Ammunition' ? randInt(1, 8) : 1;
  return {
    ...item,
    shop_price_gp: Math.max(1, Math.round((item.cost_gp || 1) * markup)),
    quantity,
  };
}

export function generateShop(allItems, payload = {}) {
  const { profession, name, rarityCounts } = payload;
  const config = PROFESSIONS[profession];
  if (!config) throw new Error('Mestiere non valido.');

  const candidates = allItems.filter((it) => config.categories.includes(it.category));
  if (candidates.length === 0) {
    throw new Error('Nessun oggetto disponibile per questo mestiere.');
  }

  const byRarity = {};
  for (const it of candidates) {
    (byRarity[it.rarity] ||= []).push(it);
  }

  const stock = [];
  const manual = rarityCounts && Object.values(rarityCounts).some((n) => Number(n) > 0);

  if (manual) {
    // The user decides exactly how many items per rarity. Preference goes to
    // items coherent with the profession; if the profession's categories run
    // out, the bucket is topped up from the whole catalog of that rarity.
    for (const [rarity, rawCount] of Object.entries(rarityCounts)) {
      const count = Math.max(0, Math.min(30, Number(rawCount) || 0));
      if (!count) continue;
      let bucket = shuffle(byRarity[rarity] || []);
      if (bucket.length < count) {
        const seen = new Set(bucket.map((it) => it.id));
        const extra = shuffle(allItems.filter((it) => it.rarity === rarity && !seen.has(it.id)));
        bucket = bucket.concat(extra);
      }
      for (const item of bucket.slice(0, count)) stock.push(priceAndQuantity(item, config));
    }
  } else {
    const stockCount = randInt(config.stockRange[0], config.stockRange[1]);
    const usedIds = new Set();
    let attempts = 0;
    while (stock.length < stockCount && attempts < stockCount * 20) {
      attempts++;
      const rarity = weightedRarity(config.rarityWeights);
      const bucket = byRarity[rarity] || candidates;
      const item = bucket[Math.floor(Math.random() * bucket.length)];
      if (usedIds.has(item.id)) continue;
      usedIds.add(item.id);
      stock.push(priceAndQuantity(item, config));
    }
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
