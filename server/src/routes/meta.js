import express from 'express';
import db from '../db/index.js';
import { ENVIRONMENTS } from '../seed/environments.js';
import { RARITY_ORDER, RARITY_LABELS_IT } from '../db/schema.js';
import { PROFESSIONS } from '../seed/professions.js';

const router = express.Router();

router.get('/', (_req, res) => {
  const creatureTypes = db.prepare('SELECT DISTINCT type FROM creatures ORDER BY type').all().map((r) => r.type);
  const itemCategories = db.prepare('SELECT DISTINCT category FROM items ORDER BY category').all().map((r) => r.category);
  const sizes = db.prepare('SELECT DISTINCT size FROM creatures ORDER BY size').all().map((r) => r.size);

  res.json({
    environments: ENVIRONMENTS,
    creatureTypes,
    itemCategories,
    sizes,
    rarities: RARITY_ORDER.map((key) => ({ key, label: RARITY_LABELS_IT[key] })),
    professions: Object.entries(PROFESSIONS).map(([key, p]) => ({ key, label: p.label })),
  });
});

export default router;
