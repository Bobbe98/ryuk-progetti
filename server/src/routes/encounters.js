import express from 'express';
import db from '../db/index.js';
import { rowToCreature } from './creatures.js';
import { xpForCr, partyXpBudget, monsterCountMultiplier } from '../utils/encounterBudget.js';

const router = express.Router();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fetchPool(environment, crMax) {
  const where = ['cr <= @crMax'];
  const params = { crMax };
  if (environment) {
    where.push('environments LIKE @environment');
    params.environment = `%"${environment}"%`;
  }
  return db.prepare(`SELECT * FROM creatures WHERE ${where.join(' AND ')}`).all(params);
}

// Build an encounter whose total XP budget is targeted either directly by a
// chosen CR (treated as "one creature of this CR is an appropriate
// challenge") or by full party-level encounter-building math.
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

  const crCeiling = mode === 'party' ? 30 : Math.max(0.125, Number(cr) || 1) * 1.5 + 2;
  const pool = fetchPool(environment, crCeiling);
  if (pool.length === 0) {
    return res.status(404).json({ error: 'Nessuna creatura trovata per i filtri selezionati (ambiente/GS).' });
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

  res.json({
    mode,
    environment: environment || null,
    budgetXp: Math.round(budget),
    totalXp: Math.round(totalXp),
    adjustedXp: Math.round(adjustedXp),
    creatures: selected.map(rowToCreature),
  });
});

export default router;
