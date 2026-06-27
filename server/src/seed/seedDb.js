import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db/index.js';
import { inferEnvironments } from './environments.js';
import { generateCrafting } from './crafting.js';
import { priceForRarity, RARITY_KEY_MAP, RARITY_RANK } from './pricing.js';
import { translateAttackAction } from './translateActions.js';
import {
  ALIGNMENT_IT, SKILL_IT, ABILITY_IT, SUBTYPE_IT,
  translateLanguages, translateDamageList, translateConditionList, translateSenses, translateSpeed,
} from './translate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRD_DIR = path.join(__dirname, '..', '..', 'data', 'srd');
const TRANSLATIONS_DIR = path.join(__dirname, 'translations');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(SRD_DIR, file), 'utf-8'));
}

function readTranslations(file) {
  return JSON.parse(fs.readFileSync(path.join(TRANSLATIONS_DIR, file), 'utf-8'));
}

const CREATURE_NAMES_IT = readTranslations('creature-names.json');
const ITEM_NAMES_IT = readTranslations('item-names.json');
const TRAITS_IT = readTranslations('traits.json');
const LEGENDARY_REACTIONS_IT = readTranslations('legendary-reactions.json');
const ACTIONS_FREEFORM_IT = readTranslations('actions-freeform.json');
const ACTION_RIDERS_IT = readTranslations('action-riders.json');
const ITEM_DESCRIPTIONS_IT = readTranslations('item-descriptions.json');
const WEAPON_ACTION_NAMES_IT = readTranslations('weapon-action-names.json');

const SIZE_IT = { Tiny: 'Minuscola', Small: 'Piccola', Medium: 'Media', Large: 'Grande', Huge: 'Enorme', Gargantuan: 'Mastodontica' };
const TYPE_IT = {
  aberration: 'aberrazione', beast: 'bestia', celestial: 'celestiale', construct: 'costrutto',
  dragon: 'drago', elemental: 'elementale', fey: 'fata', fiend: 'demone/diavolo', giant: 'gigante',
  humanoid: 'umanoide', monstrosity: 'mostruosità', ooze: 'melma', plant: 'pianta', undead: 'non-morto',
};

function buildMonsterDescription(m, nameIt, alignmentIt, subtypeIt) {
  const size = SIZE_IT[m.size] || m.size;
  const type = TYPE_IT[m.type] || m.type;
  const sub = subtypeIt ? ` (${subtypeIt})` : '';
  return `${nameIt} è una creatura di taglia ${size}, di tipo ${type}${sub}, di allineamento ${alignmentIt}. Grado di Sfida ${m.challenge_rating}.`;
}

function extractProficiencies(m, prefix) {
  const out = {};
  for (const p of m.proficiencies || []) {
    if (p.proficiency?.index?.startsWith(prefix)) {
      const label = p.proficiency.name.replace(/^Saving Throw: |^Skill: /, '');
      out[label] = p.value;
    }
  }
  return out;
}

function translateLabeledMap(obj, dict) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[dict[k] || k] = v;
  return out;
}

function translateAbilityList(list, dict, monsterIndex, kind) {
  return (list || []).map((t, i) => {
    const tr = dict[`srd-${monsterIndex}::${kind}::${i}`];
    return tr ? { ...t, name: tr.name, desc: tr.desc } : t;
  });
}

function translateActions(actions, monsterIndex) {
  return (actions || []).map((a, i) => {
    const key = `srd-${monsterIndex}::action::${i}`;
    const parsed = translateAttackAction(a.desc);
    if (parsed) {
      const name = WEAPON_ACTION_NAMES_IT[a.name] || a.name;
      let desc = parsed.opening;
      if (parsed.riderEn) {
        const riderIt = ACTION_RIDERS_IT[key];
        if (riderIt) desc += ` ${riderIt}`;
      }
      return { ...a, name, desc };
    }
    const tr = ACTIONS_FREEFORM_IT[key];
    return tr ? { ...a, name: tr.name, desc: tr.desc } : a;
  });
}

function seedMonsters() {
  const monsters = readJson('monsters.json');
  const insert = db.prepare(`
    INSERT INTO creatures (
      id, source, name, size, type, subtype, alignment, ac, ac_detail, hp, hit_dice, speed,
      str, dex, con, intl, wis, cha, saving_throws, skills, damage_vulnerabilities,
      damage_resistances, damage_immunities, condition_immunities, senses, languages,
      cr, xp, proficiency_bonus, traits, actions, legendary_actions, reactions,
      environments, image_url, description
    ) VALUES (
      @id, 'srd', @name, @size, @type, @subtype, @alignment, @ac, @ac_detail, @hp, @hit_dice, @speed,
      @str, @dex, @con, @intl, @wis, @cha, @saving_throws, @skills, @damage_vulnerabilities,
      @damage_resistances, @damage_immunities, @condition_immunities, @senses, @languages,
      @cr, @xp, @proficiency_bonus, @traits, @actions, @legendary_actions, @reactions,
      @environments, @image_url, @description
    )
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, size=excluded.size, type=excluded.type, subtype=excluded.subtype,
      alignment=excluded.alignment, ac=excluded.ac, ac_detail=excluded.ac_detail, hp=excluded.hp,
      hit_dice=excluded.hit_dice, speed=excluded.speed, str=excluded.str, dex=excluded.dex,
      con=excluded.con, intl=excluded.intl, wis=excluded.wis, cha=excluded.cha,
      saving_throws=excluded.saving_throws, skills=excluded.skills,
      damage_vulnerabilities=excluded.damage_vulnerabilities, damage_resistances=excluded.damage_resistances,
      damage_immunities=excluded.damage_immunities, condition_immunities=excluded.condition_immunities,
      senses=excluded.senses, languages=excluded.languages, cr=excluded.cr, xp=excluded.xp,
      proficiency_bonus=excluded.proficiency_bonus, traits=excluded.traits, actions=excluded.actions,
      legendary_actions=excluded.legendary_actions, reactions=excluded.reactions,
      environments=excluded.environments, image_url=excluded.image_url, description=excluded.description
  `);

  const tx = db.transaction((list) => {
    for (const m of list) {
      const nameIt = CREATURE_NAMES_IT[`srd-${m.index}`] || m.name;
      const alignmentIt = ALIGNMENT_IT[(m.alignment || '').toLowerCase()] || m.alignment || 'allineamento variabile';
      const subtypeIt = m.subtype ? (SUBTYPE_IT[m.subtype] || m.subtype) : null;
      insert.run({
        id: `srd-${m.index}`,
        name: nameIt,
        size: m.size,
        type: m.type,
        subtype: subtypeIt,
        alignment: alignmentIt,
        ac: m.armor_class?.[0]?.value ?? null,
        ac_detail: JSON.stringify(m.armor_class || []),
        hp: m.hit_points,
        hit_dice: m.hit_points_roll || m.hit_dice,
        speed: JSON.stringify(translateSpeed(m.speed)),
        str: m.strength, dex: m.dexterity, con: m.constitution,
        intl: m.intelligence, wis: m.wisdom, cha: m.charisma,
        saving_throws: JSON.stringify(translateLabeledMap(extractProficiencies(m, 'saving-throw-'), ABILITY_IT)),
        skills: JSON.stringify(translateLabeledMap(extractProficiencies(m, 'skill-'), SKILL_IT)),
        damage_vulnerabilities: JSON.stringify(translateDamageList(m.damage_vulnerabilities)),
        damage_resistances: JSON.stringify(translateDamageList(m.damage_resistances)),
        damage_immunities: JSON.stringify(translateDamageList(m.damage_immunities)),
        condition_immunities: JSON.stringify(translateConditionList((m.condition_immunities || []).map((c) => c.name))),
        senses: JSON.stringify(translateSenses(m.senses)),
        languages: translateLanguages(m.languages),
        cr: m.challenge_rating,
        xp: m.xp,
        proficiency_bonus: m.proficiency_bonus,
        traits: JSON.stringify(translateAbilityList(m.special_abilities, TRAITS_IT, m.index, 'trait')),
        actions: JSON.stringify(translateActions(m.actions, m.index)),
        legendary_actions: JSON.stringify(translateAbilityList(m.legendary_actions, LEGENDARY_REACTIONS_IT, m.index, 'legendary')),
        reactions: JSON.stringify(translateAbilityList(m.reactions, LEGENDARY_REACTIONS_IT, m.index, 'reaction')),
        environments: JSON.stringify(inferEnvironments(m)),
        image_url: m.image ? `https://www.dnd5eapi.co${m.image}` : null,
        description: buildMonsterDescription(m, nameIt, alignmentIt, subtypeIt),
      });
    }
  });
  tx(monsters);
  console.log(`Seeded ${monsters.length} creatures (SRD).`);
}

function describeMagicItem(it) {
  return (it.desc || []).join('\n\n');
}

function seedMagicItems() {
  const raw = readJson('magic-items.json');
  const items = raw.filter((it) => !(it.variant === false && (it.variants || []).length > 0));

  const insert = db.prepare(`
    INSERT INTO items (
      id, source, name, category, rarity, rarity_rank, cost_gp, attunement, weight,
      description, properties, crafting_materials, crafting_procedure, image_url
    ) VALUES (
      @id, 'srd', @name, @category, @rarity, @rarity_rank, @cost_gp, @attunement, @weight,
      @description, @properties, @crafting_materials, @crafting_procedure, @image_url
    )
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, category=excluded.category, rarity=excluded.rarity,
      rarity_rank=excluded.rarity_rank, cost_gp=excluded.cost_gp, attunement=excluded.attunement,
      weight=excluded.weight, description=excluded.description, properties=excluded.properties,
      crafting_materials=excluded.crafting_materials, crafting_procedure=excluded.crafting_procedure,
      image_url=excluded.image_url
  `);

  const tx = db.transaction((list) => {
    for (const it of list) {
      const key = `srd-item-${it.index}`;
      const rarityKey = RARITY_KEY_MAP[it.rarity?.name] || 'varies';
      const category = it.equipment_category?.name || 'Wondrous Items';
      const descEn = describeMagicItem(it);
      const nameIt = ITEM_NAMES_IT[key] || it.name;
      const { crafting_materials, crafting_procedure } = generateCrafting(category, rarityKey, nameIt);
      insert.run({
        id: key,
        name: nameIt,
        category,
        rarity: rarityKey,
        rarity_rank: RARITY_RANK[rarityKey],
        cost_gp: priceForRarity(rarityKey, it.index),
        attunement: /requires attunement/i.test(descEn) ? 1 : 0,
        weight: null,
        description: ITEM_DESCRIPTIONS_IT[key] || descEn,
        properties: JSON.stringify({ variant: it.variant, variants: (it.variants || []).map((v) => v.name) }),
        crafting_materials: JSON.stringify(crafting_materials),
        crafting_procedure,
        image_url: it.image ? `https://www.dnd5eapi.co${it.image}` : null,
      });
    }
  });
  tx(items);
  console.log(`Seeded ${items.length} magic items (SRD).`);
}

function gpValue(cost) {
  if (!cost) return 0;
  const rates = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };
  return cost.quantity * (rates[cost.unit] ?? 1);
}

function describeEquipment(eq) {
  if (eq.desc && eq.desc.length) return eq.desc.join('\n\n');
  const parts = [];
  if (eq.equipment_category?.name === 'Weapon') {
    parts.push(`Arma ${eq.weapon_category || ''} (${eq.category_range || eq.weapon_range || ''}).`);
    if (eq.damage) parts.push(`Danni: ${eq.damage.damage_dice} ${eq.damage.damage_type?.name?.toLowerCase() || ''}.`);
    if (eq.properties?.length) parts.push(`Proprietà: ${eq.properties.map((p) => p.name).join(', ')}.`);
    if (eq.range) parts.push(`Gittata: ${eq.range.normal}${eq.range.long ? `/${eq.range.long}` : ''} ft.`);
  } else if (eq.equipment_category?.name === 'Armor') {
    parts.push(`Armatura ${eq.armor_category || ''}. Classe Armatura base ${eq.armor_class?.base ?? '-'}${eq.armor_class?.dex_bonus ? ' + modificatore Destrezza' : ''}.`);
    if (eq.str_minimum) parts.push(`Forza minima richiesta: ${eq.str_minimum}.`);
    if (eq.stealth_disadvantage) parts.push('Svantaggio alle prove di Furtività.');
  } else if (eq.equipment_category?.name === 'Tools') {
    parts.push('Strumento da artigiano o set di attrezzi specialistici.');
  } else if (eq.equipment_category?.name === 'Mounts and Vehicles') {
    parts.push('Cavalcatura o veicolo.');
    if (eq.speed) parts.push(`Velocità: ${eq.speed.quantity} ${eq.speed.unit}.`);
  } else {
    parts.push('Oggetto di equipaggiamento da avventuriero.');
  }
  return parts.join(' ');
}

function seedEquipment() {
  const equipment = readJson('equipment.json');
  const insert = db.prepare(`
    INSERT INTO items (
      id, source, name, category, rarity, rarity_rank, cost_gp, attunement, weight,
      description, properties, crafting_materials, crafting_procedure, image_url
    ) VALUES (
      @id, 'srd', @name, @category, 'common', 0, @cost_gp, 0, @weight,
      @description, @properties, @crafting_materials, @crafting_procedure, NULL
    )
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, category=excluded.category, cost_gp=excluded.cost_gp,
      weight=excluded.weight, description=excluded.description, properties=excluded.properties,
      crafting_materials=excluded.crafting_materials, crafting_procedure=excluded.crafting_procedure
  `);

  const tx = db.transaction((list) => {
    for (const eq of list) {
      const key = `srd-equip-${eq.index}`;
      const category = eq.equipment_category?.name || 'Adventuring Gear';
      const nameIt = ITEM_NAMES_IT[key] || eq.name;
      const { crafting_materials, crafting_procedure } = generateCrafting(category, 'common', nameIt);
      insert.run({
        id: key,
        name: nameIt,
        category,
        cost_gp: gpValue(eq.cost),
        weight: eq.weight ?? null,
        description: ITEM_DESCRIPTIONS_IT[key] || describeEquipment(eq),
        properties: JSON.stringify({ weapon_category: eq.weapon_category, armor_category: eq.armor_category, properties: (eq.properties || []).map((p) => p.name) }),
        crafting_materials: JSON.stringify(crafting_materials),
        crafting_procedure,
      });
    }
  });
  tx(equipment);
  console.log(`Seeded ${equipment.length} mundane equipment items (SRD).`);
}

function main() {
  seedMonsters();
  seedMagicItems();
  seedEquipment();
  console.log('Seeding complete.');
}

main();
