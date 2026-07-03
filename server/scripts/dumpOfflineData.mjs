// One-off export of the seeded SRD dataset to static JSON, consumed by the
// client's offline (Capacitor/Android) data layer so the app works without
// a server connection. Run with `node scripts/dumpOfflineData.mjs`.
import db from '../src/db/index.js';
import { rowToCreature } from '../src/routes/creatures.js';
import { rowToItem } from '../src/routes/items.js';
import { rowToSpell } from '../src/routes/spells.js';
import { HOMEBREW_CREATURES, HOMEBREW_ITEMS } from '../src/seed/homebrew.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const outDir = path.resolve(fileURLToPath(import.meta.url), '../../../client/src/data');

// Bundle the seeded SRD content plus the curated, seed-time homebrew (by
// stable id) — but not arbitrary homebrew a developer may have created
// locally via the live API, which should stay server-only.
const homebrewCreatureIds = HOMEBREW_CREATURES.map((c) => c.id);
const homebrewItemIds = HOMEBREW_ITEMS.map((it) => it.id);

const creaturePlaceholders = homebrewCreatureIds.map(() => '?').join(',');
const itemPlaceholders = homebrewItemIds.map(() => '?').join(',');

const creatures = db.prepare(
  `SELECT * FROM creatures WHERE source = 'srd' OR id IN (${creaturePlaceholders})`
).all(...homebrewCreatureIds).map(rowToCreature);
const items = db.prepare(
  `SELECT * FROM items WHERE source = 'srd' OR id IN (${itemPlaceholders})`
).all(...homebrewItemIds).map(rowToItem);

const spells = db.prepare(`SELECT * FROM spells WHERE source = 'srd'`).all().map(rowToSpell);

writeFileSync(path.join(outDir, 'creatures.json'), JSON.stringify(creatures));
writeFileSync(path.join(outDir, 'items.json'), JSON.stringify(items));
writeFileSync(path.join(outDir, 'spells.json'), JSON.stringify(spells));

console.log(`Esportate ${creatures.length} creature, ${items.length} oggetti e ${spells.length} incantesimi in ${outDir}`);
