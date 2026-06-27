// Static Italian translation layer applied to the raw SRD (English) dataset
// at seed time, so the SQLite DB (and everything dumped from it into the
// offline Android bundle) ends up fully in Italian. Kept separate from
// seedDb.js so it can be unit-reasoned-about and extended independently.

export const ALIGNMENT_IT = {
  'lawful good': 'legale buono',
  'neutral good': 'neutrale buono',
  'chaotic good': 'caotico buono',
  'lawful neutral': 'legale neutrale',
  neutral: 'neutrale',
  'chaotic neutral': 'caotico neutrale',
  'lawful evil': 'legale malvagio',
  'neutral evil': 'neutrale malvagio',
  'chaotic evil': 'caotico malvagio',
  unaligned: 'non allineato',
  'any alignment': 'qualsiasi allineamento',
  'any chaotic alignment': 'qualsiasi allineamento caotico',
  'any evil alignment': 'qualsiasi allineamento malvagio',
  'any non-good alignment': 'qualsiasi allineamento non buono',
  'any non-lawful alignment': 'qualsiasi allineamento non legale',
  'neutral good (50%) or neutral evil (50%)': 'neutrale buono (50%) o neutrale malvagio (50%)',
};

export const SKILL_IT = {
  Acrobatics: 'Acrobazia', Arcana: 'Arcano', Athletics: 'Atletica', Deception: 'Inganno',
  History: 'Storia', Insight: 'Intuizione', Intimidation: 'Intimidire', Investigation: 'Investigare',
  Medicine: 'Medicina', Nature: 'Natura', Perception: 'Percezione', Performance: 'Intrattenere',
  Persuasion: 'Persuasione', Religion: 'Religione', Stealth: 'Furtività', Survival: 'Sopravvivenza',
};

export const ABILITY_IT = { STR: 'FOR', DEX: 'DES', CON: 'COS', INT: 'INT', WIS: 'SAG', CHA: 'CAR' };

export const DAMAGE_TYPE_IT = {
  acid: 'acido', bludgeoning: 'contundenti', cold: 'freddo', fire: 'fuoco', lightning: 'fulmine',
  necrotic: 'necrotico', piercing: 'perforanti', poison: 'veleno', psychic: 'psichico',
  radiant: 'radiante', slashing: 'taglienti', thunder: 'tuono', force: 'forza',
};

export const DAMAGE_PHRASE_IT = {
  'damage from spells': 'danni da incantesimi',
  "bludgeoning, piercing, and slashing from nonmagical attacks (from stoneskin)": 'contundenti, perforanti e taglienti da attacchi non magici (da pelle di pietra)',
  'bludgeoning, piercing, and slashing from nonmagical weapons': 'contundenti, perforanti e taglienti da armi non magiche',
  "bludgeoning, piercing, and slashing from nonmagical weapons that aren't adamantine": 'contundenti, perforanti e taglienti da armi non magiche che non siano di adamantio',
  "bludgeoning, piercing, and slashing from nonmagical weapons that aren't silvered": 'contundenti, perforanti e taglienti da armi non magiche che non siano argentate',
  "piercing and slashing from nonmagical weapons that aren't adamantine": 'perforanti e taglienti da armi non magiche che non siano di adamantio',
  'piercing from magic weapons wielded by good creatures': 'perforanti da armi magiche brandite da creature buone',
};

export const CONDITION_IT = {
  Blinded: 'Accecato', Charmed: 'Affascinato', Deafened: 'Assordato', Exhaustion: 'Spossatezza',
  Frightened: 'Spaventato', Grappled: 'Afferrato', Paralyzed: 'Paralizzato', Petrified: 'Pietrificato',
  Poisoned: 'Avvelenato', Prone: 'Prono', Restrained: 'Trattenuto', Stunned: 'Stordito',
  Unconscious: 'Privo di sensi',
};

export const SENSE_IT = {
  blindsight: 'percezione cieca', darkvision: 'scurovisione', tremorsense: 'percezione tellurica',
  truesight: 'vista pura', passive_perception: 'Percezione passiva',
};

export const LANGUAGE_IT = {
  Abyssal: 'Abissale', Aquan: 'Acquatico', Auran: 'Aereo', Celestial: 'Celestiale', Common: 'Comune',
  'Deep Speech': 'Profondo', Draconic: 'Draconico', Druidic: 'Druidico', Dwarvish: 'Nanico',
  Elvish: 'Elfico', Giant: 'Gigante', Gnoll: 'Gnoll', Gnomish: 'Gnomesco', Goblin: 'Goblin',
  Ignan: 'Igneo', Infernal: 'Infernale', Orc: 'Orchesco', Primordial: 'Primordiale',
  Sahuagin: 'Sahuagin', Sylvan: 'Silvano', Terran: 'Terreo', Undercommon: 'Sottocomune',
  'Blink Dog': 'dei cani lampeggianti', 'Giant Eagle': "delle aquile gigan­ti", 'Giant Elk': "degli alci giganti",
  'Giant Owl': 'dei gufi giganti', Otyugh: 'degli otyugh', Sphinx: 'delle sfingi',
  'Winter Wolf': 'dei lupi invernali', Worg: 'dei worg',
};

const FT_TO_M_TABLE = { 5: 1.5, 10: 3, 15: 4.5, 20: 6, 25: 7.5, 30: 9, 40: 12, 50: 15, 60: 18, 80: 24, 90: 27, 100: 30, 120: 36, 150: 45 };
function ftToMLang(ft) {
  const n = Number(ft);
  const m = FT_TO_M_TABLE[n] ?? Math.round(n * 0.3048 * 2) / 2;
  return Number.isInteger(m) ? String(m) : String(m).replace('.', ',');
}

const LANG_PHRASE_IT = [
  [/^Common plus up to five other languages$/i, 'Comune più fino a cinque altre lingue'],
  [/^Druidic plus any two languages$/i, 'Druidico più altre due lingue a scelta'],
  [/^Thieves' cant plus any two languages$/i, "Gergo dei ladri più altre due lingue a scelta"],
  [/^any four languages$/i, 'quattro lingue a scelta'],
  [/^any six languages$/i, 'sei lingue a scelta'],
  [/^any two languages$/i, 'due lingue a scelta'],
  [/^any one language$/i, 'una lingua a scelta'],
  [/^any one language \(usually Common\)$/i, 'una lingua a scelta (di solito Comune)'],
  [/^any languages it knew in life$/i, 'le lingue che conosceva in vita'],
  [/^the languages it knew in life$/i, 'le lingue che conosceva in vita'],
  [/^one language known by its creator$/i, 'una lingua conosciuta dal suo creatore'],
  [/^all$/i, 'tutte'],
  [/^understands all languages it knew in life but can't speak$/i, "comprende tutte le lingue che conosceva in vita ma non può parlare"],
  [/^understands all languages it spoke in life but can't speak$/i, "comprende tutte le lingue che parlava in vita ma non può parlare"],
  [/^understands commands given in any language but can't speak$/i, "comprende i comandi impartiti in qualsiasi lingua ma non può parlare"],
  [/^understands the languages of its creator but can't speak$/i, "comprende le lingue del suo creatore ma non può parlare"],
];

function translateLanguageToken(tok) {
  const t = tok.trim();
  if (!t) return '';
  const tele = t.match(/^telepathy (\d+) ft\.(?: \(works only with creatures that understand Abyssal\))?$/i);
  if (tele) {
    const m = ftToMLang(tele[1]);
    return /Abyssal/i.test(t)
      ? `telepatia ${m} m (funziona solo con creature che comprendono l'Abissale)`
      : `telepatia ${m} m`;
  }
  for (const [re, repl] of LANG_PHRASE_IT) {
    if (re.test(t)) return t.replace(re, repl);
  }
  const m1 = t.match(/^understands (.+?) but can't speak( it)?$/i) || t.match(/^understands (.+?) but doesn't speak it$/i);
  if (m1) return `comprende ${LANGUAGE_IT[m1[1]] || m1[1]} ma non può parlare`;
  const m2 = t.match(/^understands (.+?) and (.+?) but can't speak$/i);
  if (m2) return `comprende ${LANGUAGE_IT[m2[1]] || m2[1]} e ${LANGUAGE_IT[m2[2]] || m2[2]} ma non può parlare`;
  const m3 = t.match(/^understands (.+)$/i);
  if (m3) return `comprende ${LANGUAGE_IT[m3[1]] || m3[1]}`;
  const m4 = t.match(/^and (.+) but can't speak$/i);
  if (m4) return `e ${LANGUAGE_IT[m4[1]] || m4[1]} ma non può parlare`;
  if (t.endsWith("(can't speak in boar form)")) {
    const base = t.replace(/\s*\(can't speak in boar form\)$/, '');
    return `${LANGUAGE_IT[base] || base} (non può parlare in forma di cinghiale)`;
  }
  return LANGUAGE_IT[t] || t;
}

export function translateLanguages(raw) {
  if (!raw) return '';
  return raw.split(',').map((tok) => translateLanguageToken(tok)).filter(Boolean).join(', ');
}

export function translateDamageList(list) {
  return (list || []).map((d) => DAMAGE_PHRASE_IT[d] || DAMAGE_TYPE_IT[d.toLowerCase()] || d);
}

export const WEAPON_CATEGORY_IT = { Martial: 'marziale', Simple: 'semplice' };
export const ARMOR_CATEGORY_IT = { Medium: 'media', Heavy: 'pesante', Light: 'leggera', Shield: 'scudo' };
export const RANGE_CATEGORY_IT = {
  'Martial Melee': 'marziale da mischia', Melee: 'da mischia', 'Martial Ranged': 'marziale a distanza',
  Ranged: 'a distanza', 'Simple Melee': 'semplice da mischia', 'Simple Ranged': 'semplice a distanza',
};
export const WEAPON_PROPERTY_IT = {
  Ammunition: 'Munizioni', Finesse: 'Finezza', Heavy: 'Pesante', Light: 'Leggera', Loading: 'Caricamento',
  Monk: 'Monaco', Reach: 'Portata', Special: 'Speciale', Thrown: 'Lanciabile', 'Two-Handed': 'A due mani',
  Versatile: 'Versatile',
};
