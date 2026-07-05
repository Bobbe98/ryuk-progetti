import express from 'express';
import db from '../db/index.js';
import { rowToCreature } from './creatures.js';
import { xpForCr, partyXpBudget, monsterCountMultiplier } from '../utils/encounterBudget.js';

const router = express.Router();

function fetchPool(environment) {
  const where = ['xp > 0'];
  const params = {};
  if (environment) {
    where.push('environments LIKE @environment');
    params.environment = `%"${environment}"%`;
  }
  return db.prepare(`SELECT * FROM creatures WHERE ${where.join(' AND ')}`).all(params);
}

// Balanced encounter builder (DMG method): the difficulty budget is compared
// against the ADJUSTED XP (base XP × multiplier for the number of monsters)
// at every step, so an encounter generated as "medium" really lands in the
// medium band. It tries many random compositions (boss, pair, small group,
// horde — duplicates allowed, like 4 goblins) and keeps the one whose
// adjusted XP is closest to the budget, never exceeding it by more than 10%.
export function buildBalancedEncounter(pool, budget, desiredCount) {
  const candidates = pool.filter((c) => (c.xp || 0) > 0 && c.xp <= budget * 1.05);
  if (candidates.length === 0) {
    // Budget below the weakest creature available: single weakest creature.
    const weakest = [...pool].sort((a, b) => (a.xp || 0) - (b.xp || 0))[0];
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
    // Groups are often homogeneous (classic packs of identical monsters).
    const homogeneous = n > 1 && Math.random() < 0.55;
    const fixed = band[Math.floor(Math.random() * band.length)];
    const selected = [];
    let totalXp = 0;
    for (let i = 0; i < n; i++) {
      const c = homogeneous ? fixed : band[Math.floor(Math.random() * band.length)];
      selected.push(c);
      totalXp += c.xp;
    }
    const adjusted = totalXp * monsterCountMultiplier(n);
    const ratio = adjusted / budget;
    let score = Math.abs(Math.log(ratio));
    if (ratio > 1.1) score += (ratio - 1.1) * 5; // never noticeably over budget
    if (!best || score < best.score) best = { selected, totalXp, score };
    if (best.score < 0.04) break;
  }
  return { selected: best.selected, totalXp: best.totalXp };
}

router.post('/generate', (req, res) => {
  const { mode = 'cr', cr, environment, partyLevel, partySize, difficulty = 'medium', creatureCount } = req.body || {};

  let budget;
  if (mode === 'party') {
    const lvl = Number(partyLevel) || 4;
    const size = Number(partySize) || 4;
    budget = partyXpBudget(lvl, size, difficulty);
  } else {
    const targetCr = cr === undefined || cr === null || cr === '' ? 1 : Number(cr);
    budget = xpForCr(targetCr);
  }

  const pool = fetchPool(environment);
  if (pool.length === 0) {
    return res.status(404).json({ error: 'Nessuna creatura trovata per i filtri selezionati (ambiente/GS).' });
  }

  const built = buildBalancedEncounter(pool, budget, creatureCount ? Number(creatureCount) : null);
  const selected = built.selected;
  const totalXp = built.totalXp;
  const adjustedXp = totalXp * monsterCountMultiplier(selected.length);

  res.json({
    mode,
    difficulty: mode === 'party' ? difficulty : null,
    environment: environment || null,
    budgetXp: Math.round(budget),
    totalXp: Math.round(totalXp),
    adjustedXp: Math.round(adjustedXp),
    creatures: selected.map(rowToCreature),
  });
});

export default router;
