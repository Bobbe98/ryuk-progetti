// Controllo offline: valida tutti i comandi, i template e le utility senza connettersi a Discord.
import assert from 'node:assert/strict';
import { commands } from './registry.js';
import { TEMPLATES } from './templates.js';
import { normalizePlan, planStats, planEmbed } from './plan.js';
import { parseDuration, chunk } from './util.js';

const json = [...commands.values()].map((c) => c.data.toJSON());
assert.ok(json.length <= 100, 'massimo 100 comandi');
for (const c of json) assert.match(c.name, /^[a-z0-9-]{1,32}$/, c.name);
console.log(`✔ ${json.length} comandi validi: ${json.map((c) => c.name).join(', ')}`);

for (const [k, t] of Object.entries(TEMPLATES)) {
  const p = normalizePlan(t.plan);
  const s = planStats(p);
  assert.ok(s.channels > 5 && s.roles > 1, k);
  planEmbed(p, t.label).toJSON();
  console.log(`✔ template ${k}: ${s.roles} ruoli, ${s.categories} categorie, ${s.channels} canali`);
}

const evil = normalizePlan({ roles: [{ name: 'Hacker', permissions: ['Administrator', 'KickMembers'] }, { name: '@everyone' }], categories: [{ name: 'X', channels: [{ name: 'a', type: 'boh' }] }] });
assert.deepEqual(evil.roles[0].permissions, ['KickMembers']);
assert.equal(evil.roles.length, 1);
assert.equal(evil.categories[0].channels[0].type, 'text');
console.log('✔ i piani AI vengono ripuliti (niente Administrator, tipi sconosciuti → testo)');

assert.equal(parseDuration('1h30m'), 90 * 6e4);
assert.equal(parseDuration('2d'), 2 * 864e5);
assert.equal(parseDuration('15'), 15 * 6e4);
assert.equal(parseDuration('boh'), null);
assert.ok(chunk('a '.repeat(3000)).every((p) => p.length <= 1900));
console.log('✔ utility ok');
