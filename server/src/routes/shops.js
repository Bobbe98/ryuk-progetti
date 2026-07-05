import express from 'express';
import db from '../db/index.js';
import { rowToItem } from './items.js';
import { PROFESSIONS } from '../seed/professions.js';

const router = express.Router();

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

router.get('/professions', (_req, res) => {
  res.json(Object.entries(PROFESSIONS).map(([key, p]) => ({ key, label: p.label })));
});

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function priceAndQuantity(item, config) {
  const markup = config.markup[0] + Math.random() * (config.markup[1] - config.markup[0]);
  const quantity = item.category === 'Adventuring Gear' || item.category === 'Ammunition' ? randInt(1, 8) : 1;
  return {
    ...rowToItem(item),
    shop_price_gp: Math.max(1, Math.round((item.cost_gp || 1) * markup)),
    quantity,
  };
}

router.post('/generate', (req, res) => {
  const { profession, name, rarityCounts } = req.body || {};
  const config = PROFESSIONS[profession];
  if (!config) return res.status(400).json({ error: 'Mestiere non valido.' });

  const placeholders = config.categories.map(() => '?').join(',');
  const candidates = db.prepare(`SELECT * FROM items WHERE category IN (${placeholders})`).all(...config.categories);

  if (candidates.length === 0) {
    return res.status(404).json({ error: 'Nessun oggetto disponibile per questo mestiere.' });
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
        const extra = shuffle(
          db.prepare('SELECT * FROM items WHERE rarity = ?').all(rarity).filter((it) => !seen.has(it.id)),
        );
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

  res.json({
    name: name || randomShopName(),
    profession: config.label,
    professionKey: profession,
    totalValueGp: totalValue,
    stock,
  });
});

export default router;
