// One-off script (not part of the seed pipeline) that walks the cached raw
// SRD JSON and writes out manifest files of every text unit that still needs
// human/LLM natural-language translation to Italian, after the structured
// (zero-risk) dictionary + attack-action-template passes have already done
// what they can. Output goes to the scratchpad, batched, for parallel
// translation agents to pick up; results get merged back by
// mergeTranslations.mjs into server/src/seed/translations/*.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateAttackAction } from '../src/seed/translateActions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRD_DIR = path.join(__dirname, '..', 'data', 'srd');
const OUT_DIR = process.argv[2] || '/tmp/claude-0/-home-user-ryuk-progetti/3106337d-d4f9-5bad-8291-119eb238fb13/scratchpad/manifest';

fs.mkdirSync(OUT_DIR, { recursive: true });

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(SRD_DIR, file), 'utf-8'));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function writeBatches(prefix, units, size) {
  const batches = chunk(units, size);
  batches.forEach((b, i) => {
    const file = path.join(OUT_DIR, `${prefix}-${String(i + 1).padStart(2, '0')}.json`);
    fs.writeFileSync(file, JSON.stringify(b, null, 2));
  });
  console.log(`${prefix}: ${units.length} units -> ${batches.length} batch(es)`);
  return batches.length;
}

const monsters = readJson('monsters.json');
const magicItemsRaw = readJson('magic-items.json');
const equipment = readJson('equipment.json');
const magicItems = magicItemsRaw.filter((it) => !(it.variant === false && (it.variants || []).length > 0));

// 1. Names
const creatureNames = monsters.map((m) => ({ key: `srd-${m.index}`, en: m.name }));
const magicItemNames = magicItems.map((it) => ({ key: `srd-item-${it.index}`, en: it.name }));
const equipmentNames = equipment.map((eq) => ({ key: `srd-equip-${eq.index}`, en: eq.name }));
writeBatches('names-creatures', creatureNames, 340);
writeBatches('names-magicitems', magicItemNames, 350);
writeBatches('names-equipment', equipmentNames, 240);

// 2. Traits / legendary actions / reactions (all freeform, 0% template match)
const traits = [];
const legendary = [];
const reactions = [];
for (const m of monsters) {
  (m.special_abilities || []).forEach((t, i) => traits.push({ key: `srd-${m.index}::trait::${i}`, name: t.name, en: t.desc }));
  (m.legendary_actions || []).forEach((t, i) => legendary.push({ key: `srd-${m.index}::legendary::${i}`, name: t.name, en: t.desc }));
  (m.reactions || []).forEach((t, i) => reactions.push({ key: `srd-${m.index}::reaction::${i}`, name: t.name, en: t.desc }));
}
writeBatches('traits', traits, 140);
writeBatches('legendary-reactions', [...legendary, ...reactions], 200);

// 3. Actions: split into (a) unmatched by the structured weapon-attack parser
//    (full freeform translation needed) and (b) matched-with-rider (only the
//    short English "rider" tail needs translation; opening is auto-generated).
const actionsFreeform = [];
const actionRiders = [];
for (const m of monsters) {
  (m.actions || []).forEach((a, i) => {
    const parsed = translateAttackAction(a.desc);
    if (!parsed) {
      actionsFreeform.push({ key: `srd-${m.index}::action::${i}`, name: a.name, en: a.desc });
    } else if (parsed.riderEn) {
      actionRiders.push({ key: `srd-${m.index}::action::${i}`, en: parsed.riderEn });
    }
  });
}
writeBatches('actions-freeform', actionsFreeform, 112);
writeBatches('action-riders', actionRiders, 124);

// 4. Item descriptions needing real translation: all magic items (always have
//    desc array text), and equipment items whose raw desc[] is non-empty
//    (others already get an Italian template description via describeEquipment()).
const itemDescriptions = [];
for (const it of magicItems) {
  const en = (it.desc || []).join('\n\n');
  if (en) itemDescriptions.push({ key: `srd-item-${it.index}`, en });
}
for (const eq of equipment) {
  const en = (eq.desc || []).join('\n\n');
  if (en) itemDescriptions.push({ key: `srd-equip-${eq.index}`, en });
}
writeBatches('item-descriptions', itemDescriptions, 113);

console.log('Done. Manifest written to', OUT_DIR);
