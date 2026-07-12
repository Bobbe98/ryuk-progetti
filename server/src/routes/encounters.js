import express from 'express';
import db from '../db/index.js';
import { rowToCreature } from './creatures.js';
import { rowToItem } from './items.js';
import { xpForCr, partyXpBudget, monsterCountMultiplier } from '../utils/encounterBudget.js';
import { rewardPlan, narrativeSeed, shuffleArray } from '../utils/encounterExtras.js';

const router = express.Router();

function isLegendary(row) {
  try {
    return (JSON.parse(row.legendary_actions || '[]') || []).length > 0;
  } catch {
    return false;
  }
}

function fetchPool(environment, creatureType) {
  const where = ['xp > 0'];
  const params = {};
  if (environment) {
    where.push('environments LIKE @environment');
    params.environment = `%"${environment}"%`;
  }
  if (creatureType) {
    where.push('type = @creatureType');
    params.creatureType = creatureType;
  }
  return db.prepare(`SELECT * FROM creatures WHERE ${where.join(' AND ')}`).all(params);
}

// Balanced encounter builder (DMG method): the difficulty budget is compared
// against the ADJUSTED XP (base XP × multiplier for the number of monsters)
// at every step, so an encounter generated as "medium" really lands in the
// medium band. It tries many random compositions (boss, pair, small group,
// horde — duplicates allowed, like 4 goblins) and keeps the one whose
// adjusted XP is closest to the budget, never exceeding it by more than 10%.
// With legendary='boss' the first slot of each composition is drawn from
// legendary creatures, so the encounter is built around a proper boss.
export function buildBalancedEncounter(pool, budget, desiredCount, opts = {}) {
  const { legendary = 'any', legendaryOf = () => false } = opts;
  let candidates = pool.filter((c) => (c.xp || 0) > 0 && c.xp <= budget * 1.05);
  if (legendary === 'exclude') candidates = candidates.filter((c) => !legendaryOf(c));
  const legendaries = legendary === 'boss' ? candidates.filter((c) => legendaryOf(c)) : [];

  if (candidates.length === 0) {
    const fallbackPool = legendary === 'exclude' ? pool.filter((c) => !legendaryOf(c)) : pool;
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
      const boss = (bossBand.length ? bossBand : legendaries)[Math.floor(Math.random() * (bossBand.length ? bossBand.length : legendaries.length))];
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
    if (ratio > 1.1) score += (ratio - 1.1) * 5; // never noticeably over budget
    if (!best || score < best.score) best = { selected, totalXp, score };
    if (best.score < 0.04) break;
  }
  return { selected: best.selected, totalXp: best.totalXp };
}

router.post('/generate', (req, res) => {
  const {
    mode = 'cr', cr, environment, creatureType, legendary = 'any',
    partyLevel, partySize, difficulty = 'medium', creatureCount,
  } = req.body || {};

  let budget;
  if (mode === 'party') {
    const lvl = Number(partyLevel) || 4;
    const size = Number(partySize) || 4;
    budget = partyXpBudget(lvl, size, difficulty);
  } else {
    const targetCr = cr === undefined || cr === null || cr === '' ? 1 : Number(cr);
    budget = xpForCr(targetCr);
  }

  const pool = fetchPool(environment, creatureType);
  if (pool.length === 0) {
    return res.status(404).json({ error: 'Nessuna creatura trovata per i filtri selezionati (tipo/ambiente).' });
  }

  const built = buildBalancedEncounter(pool, budget, creatureCount ? Number(creatureCount) : null, {
    legendary,
    legendaryOf: isLegendary,
  });
  const selected = built.selected;
  const totalXp = built.totalXp;
  const adjustedXp = totalXp * monsterCountMultiplier(selected.length);

  // Rewards: gold scaled on the budget plus 0-2 items whose rarity scales
  // with the strongest creature in the encounter.
  const plan = rewardPlan(selected, budget);
  const placeholders = plan.band.map(() => '?').join(',');
  const rewardCandidates = db.prepare(`SELECT * FROM items WHERE rarity IN (${placeholders})`).all(...plan.band);
  const rewardItems = shuffleArray(rewardCandidates).slice(0, plan.itemCount).map(rowToItem);

  res.json({
    mode,
    difficulty: mode === 'party' ? difficulty : null,
    environment: environment || null,
    creatureType: creatureType || null,
    budgetXp: Math.round(budget),
    totalXp: Math.round(totalXp),
    adjustedXp: Math.round(adjustedXp),
    creatures: selected.map(rowToCreature),
    narrative: narrativeSeed(),
    rewards: { gold_gp: plan.gold, items: rewardItems },
  });
});

export default router;
