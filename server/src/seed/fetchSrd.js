// One-off script: downloads the full SRD 5.1 (OGL) dataset from the public
// dnd5eapi.co API and caches it locally so the app never needs network
// access at runtime. Re-run with `npm run fetch-srd` to refresh the cache.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'data', 'srd');
const BASE = 'https://www.dnd5eapi.co/api/2014';
const CONCURRENCY = 8;

fs.mkdirSync(OUT_DIR, { recursive: true });

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function fetchCollection(endpoint, outFile) {
  console.log(`Fetching list: ${endpoint}`);
  const list = await getJson(`${BASE}/${endpoint}`);
  console.log(`  ${list.count} entries, fetching details...`);
  const details = await mapWithConcurrency(list.results, CONCURRENCY, async (item, i) => {
    if (i % 50 === 0) console.log(`  ${endpoint}: ${i}/${list.results.length}`);
    try {
      return await getJson(`https://www.dnd5eapi.co${item.url}`);
    } catch (e) {
      console.warn(`  failed ${item.url}: ${e.message}`);
      return null;
    }
  });
  const clean = details.filter(Boolean);
  fs.writeFileSync(path.join(OUT_DIR, outFile), JSON.stringify(clean));
  console.log(`  saved ${clean.length} -> ${outFile}`);
  return clean;
}

async function main() {
  await fetchCollection('monsters', 'monsters.json');
  await fetchCollection('magic-items', 'magic-items.json');
  await fetchCollection('equipment', 'equipment.json');
  await fetchCollection('spells', 'spells.json');
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
