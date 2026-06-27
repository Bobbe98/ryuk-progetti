// One-off export of the seeded SRD dataset to static JSON, consumed by the
// client's offline (Capacitor/Android) data layer so the app works without
// a server connection. Run with `node scripts/dumpOfflineData.mjs`.
import db from '../src/db/index.js';
import { rowToCreature } from '../src/routes/creatures.js';
import { rowToItem } from '../src/routes/items.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const outDir = path.resolve(fileURLToPath(import.meta.url), '../../../client/src/data');

const creatures = db.prepare("SELECT * FROM creatures WHERE source = 'srd'").all().map(rowToCreature);
const items = db.prepare("SELECT * FROM items WHERE source = 'srd'").all().map(rowToItem);

writeFileSync(path.join(outDir, 'creatures.json'), JSON.stringify(creatures));
writeFileSync(path.join(outDir, 'items.json'), JSON.stringify(items));

console.log(`Esportate ${creatures.length} creature e ${items.length} oggetti in ${outDir}`);
