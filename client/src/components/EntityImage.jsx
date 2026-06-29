import { useState } from 'react';

const PALETTES = [
  ['#7c2d12', '#1c0a05'], ['#1e3a8a', '#0a1330'], ['#14532d', '#06190f'],
  ['#581c87', '#1a0a26'], ['#854d0e', '#241502'], ['#3f3f46', '#101012'],
  ['#831843', '#220612'],
];

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

// Base line-art glyphs (24x24, stroke-based) keyed by creature type, used as
// a fallback watermark when no bespoke per-creature glyph (below) applies.
const CREATURE_GLYPHS = {
  aberration: 'M12 4a4 4 0 0 1 4 4c0 2-1.5 3-1.5 5M8 8a4 4 0 0 1 4-4M6 12c0 4 2.5 7 6 7s6-3 6-7M9 12v3M15 12v3M12 12v4',
  beast: 'M7 9a2 2 0 1 1 0 .1M17 9a2 2 0 1 1 0 .1M9.5 6a1.5 1.5 0 1 1 0 .1M14.5 6a1.5 1.5 0 1 1 0 .1M12 11c-3 0-5 2-5 4.5S9 19 12 19s5-1 5-3.5S15 11 12 11Z',
  celestial: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  construct: 'M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  dragon: 'M3 16c2-1 3-3 3-5 0-1 1-2 2-1 1-3 4-5 7-5 1.5 0 2 1 1.5 2 2 .5 3.5 2 4.5 4-1.5 0-2.5.5-3 1.5-1-1-2.5-1.5-4-1-1 1.5-2.5 2.5-4 2.5L7 17',
  elemental: 'M12 3c3 4 5 7 5 10a5 5 0 1 1-10 0c0-3 2-6 5-10Z',
  fey: 'M12 2c2 4 6 6 6 10a6 6 0 1 1-12 0c0-4 4-6 6-10ZM6 18c2 0 3 1 3 3M18 18c-2 0-3 1-3 3',
  fiend: 'M5 9c0-3 3-6 7-6s7 3 7 6c0 3-2 4-2 6v2H7v-2c0-2-2-3-2-6ZM5 9 2 7M19 9l3-2M9 19v2M15 19v2M9.5 11h.1M14.5 11h.1',
  giant: 'M7 21l3-9-2-3 2-3h4l2 3-2 3 3 9M9 7l-2-4M15 7l2-4',
  humanoid: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 21c0-4.5 2.7-7 6-7s6 2.5 6 7',
  monstrosity: 'M4 10c2-4 5-6 8-6s6 2 8 6c-2 1-2 3-1 5-2 1-4 1-5-1-1 2-3 2-4 0-1 2-3 2-5 1 1-2 1-4-1-5Z',
  ooze: 'M12 4c3 3 6 7 6 10.5A6 6 0 0 1 6 14.5C6 11 9 7 12 4Zm-2 9h.1m3.9 1h.1',
  plant: 'M12 21V9M12 9C9 9 6 7 6 4c3 0 5 1.5 6 3.5C13 5.5 15 4 18 4c0 3-3 5-6 5ZM8 14c1.5 1 2.5 2 4 2M16 17c-1.5 1-2.5 1.5-4 1.5',
  undead: 'M12 3a7 7 0 0 0-7 7c0 2.5 1.3 4 2 5v3h3v-2h4v2h3v-3c.7-1 2-2.5 2-5a7 7 0 0 0-7-7ZM9.5 10h.1M14.5 10h.1M10 14h4',
  'swarm of Tiny beasts': 'M6 8h.1M10 6h.1M15 7h.1M18 10h.1M5 13h.1M9 14h.1M13 13h.1M17 15h.1M7 18h.1M12 18h.1M16 19h.1',
};

// Bespoke, name-keyed glyphs for original homebrew creatures, so each one
// gets a unique visual identity instead of sharing a single icon with every
// other creature of its broad SRD type.
const CREATURE_NAME_GLYPHS = {
  'sciacallo di brace': 'M4 18c0-5 3-9 7-9l1-3 1 3c4 0 7 4 7 9-2 2-4 1-6 1l-1 2-1-2c-2 0-4 1-6-1ZM12 9c.5-1 .5-2 0-3M9 13h.1M15 13h.1',
  'spina cantante': 'M12 21V11M12 11c-3-1-5-3-5-6 3 0 5 1 6 3 1-2 3-3 6-3 0 3-2 5-5 6M9 16l-2 1M15 16l2 1M12 11l-2-2M12 11l2-2',
  "guardiano d'argilla": 'M9 3h6v5H9V3ZM7 9h10v9H7V9ZM5 12h2v4H5v-4ZM17 12h2v4h-2v-4ZM9 19h2v3H9v-3ZM13 19h2v3h-2v-3ZM10 12h.1M14 12h.1',
  'strige lunare': 'M12 3a7 7 0 1 0 7 9 7 7 0 0 1-7-9ZM4 14l4-2M20 14l-4-2M8 17l2 4M16 17l-2 4',
  "ondina dell'abisso nero": "M4 12c2-3 4-4 8-4s6 1 8 4c-2 3-4 4-8 4s-6-1-8-4ZM12 8c-2 1-3 2-3 4s1 3 3 4M3 17c2-1 4-1 6 0M15 17c2-1 4-1 6 0",
  'custode delle rovine stellari': 'M12 2l1.5 4.5H18l-3.7 2.7L15.8 14 12 11.2 8.2 14l1.5-4.8L6 6.5h4.5L12 2ZM7 18h10v3H7v-3Z',
  'spettro del faro': 'M10 22V10l2-7 2 7v12M8 22h8M9 6h6M5 16c2-2 3 2 5 0s3 2 5 0',
  'diavoletto dei contratti': 'M9 10c0-3 1-5 3-5s3 2 3 5c1 0 2 1 2 2-1 2-2 2-3 1-1 1-3 1-4 0-1 1-2 1-3-1 0-1 1-2 2-2ZM6 8l-2-2M18 8l2-2M9 21l3-6 3 6',
  'serpe di vetro': 'M3 18c2-2 2-4 0-6s-2-4 0-6 2-4 0-6M5 18l3-2-1-3 3-1-1-3 3-1M21 4l-4 4',
  'colosso di radici': 'M12 3v8M9 11c-2 1-4 3-5 6M15 11c2 1 4 3 5 6M7 21c1-3 3-5 5-5s4 2 5 5M9 7l-2-1M15 7l2-1',
  'cantastorie di bruma': 'M12 4a5 5 0 0 0-5 5c0 2 1 3 2 4-2 0-4 1-5 3M12 4a5 5 0 0 1 5 5c0 2-1 3-2 4 2 0 4 1 5 3M9 11h.1M15 11h.1',
  "melma dell'eco": 'M12 4c3 4 6 8 6 11.5A6 6 0 0 1 6 15.5C6 12 9 8 12 4ZM15 9c1 1 2 2.5 2 4M17 7c1.5 1.5 3 4 3 6',
};

// Broad category glyphs for items: used as a fallback when no keyword
// sub-icon (below) matches the item's Italian name.
const ITEM_GLYPHS = {
  Weapon: 'M5 19 16 8M14 4l6 6-2 2-6-6 2-2ZM3 21l3-1 1-3-3 1-1 3Z',
  Armor: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z',
  Ammunition: 'M4 20 18 6M14 4l6 2-2 6-2-2 2-2-2-2-2 2-2-2ZM4 20l3-1-1-2-2 3Z',
  'Wondrous Items': 'M12 2l1.8 5.6H19l-4.6 3.4 1.8 5.6L12 13.2 7.8 16.6l1.8-5.6L5 8h5.2L12 2Z',
  Ring: 'M12 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM9 6l3-4 3 4',
  Rod: 'M6 19 17 6M5 21l2-3 2 1-2 3ZM16 5l2-2 2 2-2 2Z',
  Potion: 'M10 2h4M11 2v5L7 14a4 4 0 0 0 4 7h2a4 4 0 0 0 4-7l-4-7V2ZM8.5 15h7',
  Scroll: 'M6 4h12v4a2 2 0 0 0 0 4 2 2 0 0 0 0 4v4H6a2 2 0 0 1 0-4 2 2 0 0 1 0-4 2 2 0 0 1 0-4V4ZM9 8h6M9 12h6',
  Staff: 'M7 21 16 4M16 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  Wand: 'M5 19 14 10M16 4l1.5 3L21 8.5 17.5 10 16 13l-1.5-3L11 8.5 14.5 7 16 4Z',
  'Adventuring Gear': 'M7 9V7a5 5 0 0 1 10 0v2M5 9h14l-1 12H6L5 9ZM9 12v4M15 12v4',
  Tools: 'M14 7l3-3 2 2-3 3 1 1-7 7-3-3 7-7 1 1ZM5 19l3-1 1-2-2-2-2 2 1 1-2 2 1 1Z',
  'Mounts and Vehicles': 'M5 18a3 3 0 1 0 0 .1M19 18a3 3 0 1 0 0 .1M5 18h14M7 18V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v9',
};

// Sub-type glyph library, shared across categories where the same shape
// applies (e.g. a book can show up as Wondrous Item or Adventuring Gear).
const SUB_GLYPH = {
  sword: 'M5 19 16 8M14 4l6 6-2 2-6-6 2-2ZM3 21l3-1 1-3-3 1-1 3Z',
  axe: 'M6 21 16 11M13 4l5 5-3 3a4 4 0 0 1-5-5l3-3Z',
  bow: 'M8 3a14 14 0 0 0 0 18M8 3l9 9-9 9M2 12h16M15 9l3 3-3 3',
  crossbow: 'M3 9h7M3 9l3-3M3 9l3 3M9 4c3 0 5 2 5 5s-2 5-5 5M9 14v6M7 20h4',
  dagger: 'M12 2 14 9h-4l2-7ZM10 9h4v2h-4ZM11 11h2v8a1 1 0 0 1-2 0v-8Z',
  mace: 'M11 22V11M8 4h8v6H8V4Z',
  flail: 'M9 21 14 14M15 12l2-2M18 9a2 2 0 1 0 0-.1M15 8l1-1M19 6l1-1',
  polearm: 'M12 22V8M9 2l3 4 3-4M9 6h6',
  whip: 'M4 20c2-4 0-6 2-8s0-4 2-6 4-2 6-2',
  amulet: 'M8 3 12 8 16 3M12 8v3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  crown: 'M4 19h16l-1-9-3 4-4-6-4 6-3-4-1 9ZM4 19v2h16v-2',
  cloak: 'M9 4h6l2 3-3 1v12a8 8 0 0 1-8 0V8l-3-1 2-3Z',
  boots: 'M9 3v10l-5 3v3h13l-1-6h-3V3H9Z',
  gloves: 'M7 13V6a2 2 0 0 1 4 0v5M11 11V5a2 2 0 0 1 4 0v6M15 12v-4a2 2 0 0 1 4 0v7c0 3-2 6-5 6H9a4 4 0 0 1-4-4v-3l2-2',
  belt: 'M3 11h6v2H3zM15 11h6v2h-6zM9 8h6v8H9z',
  bag: 'M9 9 8 6h8l-1 3M7 9h10l1 6a5 5 0 0 1-5 6h-2a5 5 0 0 1-5-6l1-6Z',
  carpet: 'M3 18c0-7 4-12 8-12M11 6a8 8 0 1 1 0 12M3 18h8M11 6v12',
  broom: 'M14 3 6 21M4 21l3-6 5 2-2 5z',
  candle: 'M12 3c1 1 1.5 2 .5 3-1 1-1 2 0 2.5M9 9h6v11H9V9ZM9 13h6',
  bell: 'M12 3v2M7 16c0-5 1.5-9 5-9s5 4 5 9H7ZM6 16h12v2H6zM11 20h2',
  mirror: 'M12 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 14v7M9 21h6',
  horn: 'M4 14c0-6 4-10 9-10 4 8 2 14-3 16-2-3-2-6 0-9-3 1-5 2-6 3Z',
  orb: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM4 12h16M12 4c2.5 2 4 5 4 8s-1.5 6-4 8M12 4c-2.5 2-4 5-4 8s1.5 6 4 8',
  brooch: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 8V4M9 5l3-1 3 1',
  lens: 'M9 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM13 16l2 5M17 3l-2 5',
  book: 'M3 6c2-1 5-1 7 0v13c-2-1-5-1-7 0V6ZM21 6c-2-1-5-1-7 0v13c2-1 5-1 7 0V6Z',
  heart: 'M12 20S4 14 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-8 11-8 11Z',
  backpack: 'M8 9V7a4 4 0 0 1 8 0v2M6 9h12l1 11H5L6 9ZM9 13h6',
  rope: 'M5 16a4 4 0 1 1 8 0 4 4 0 1 1 8 0M5 16c0 3 2 5 4 5M21 16c0 3-2 5-4 5',
  bottle: 'M10 2h4v4l2 3v10a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3V9l2-3V2ZM9 13h6',
  chest: 'M3 10h18v9H3v-9ZM3 10l2-4h14l2 4M11 14h2',
  tent: 'M12 4 21 20H3L12 4ZM12 4v16M8 20l4-9 4 9',
  ladder: 'M7 2v20M17 2v20M7 6h10M7 11h10M7 16h10',
  torch: 'M11 22V10M9 10c0-3 1-5 3-8 2 3 3 5 3 8a3 3 0 0 1-6 0Z',
  lantern: 'M9 8h6l1 3v6a4 4 0 0 1-8 0V11l1-3ZM12 2v3M12 17v3M9 5h6',
  shield: 'M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3ZM12 7v10M8 12h8',
  dragonscale: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3ZM8 10l2 2 2-2 2 2 2-2',
  instrument: 'M9 18a3 3 0 1 0 0-.1M9 18V5l10-2v11M19 14a3 3 0 1 0 0-.1',
  lockpick: 'M6 21 16 11M14 4l1 1-9 9-1-1 9-9ZM18 6a2 2 0 1 0 0-.1',
  dice: 'M5 8l7-4 7 4v8l-7 4-7-4V8ZM12 4v16M5 8l7 4 7-4M9 11h.1M15 11h.1M12 15h.1',
  artisan: 'M5 19l6-6M9 5l3 3-7 7-3-3 7-7ZM15 13l6 6-2 2-6-6 2-2Z',
  saddle: 'M4 16c0-4 4-7 8-7s8 3 8 7c-3 1-5 0-8 0s-5 1-8 0Z',
  ship: 'M4 14h16l-2 6H6l-2-6ZM12 14V4M8 7h8M12 4l4 3M12 4l-4 3',
  horse: 'M6 20v-6c0-5 3-9 7-9 2 0 3 1 3 1l3-1-1 3s1 2 1 4-1 3-1 3l1 2-3-1-2 2-1-2H9l-1 2-2-1Z',
};

const WEAPON_KEYWORDS = [
  [/ascia|scure/, SUB_GLYPH.axe],
  [/balestra/, SUB_GLYPH.crossbow],
  [/arco\b/, SUB_GLYPH.bow],
  [/pugnal|stiletto/, SUB_GLYPH.dagger],
  [/mazzafrust/, SUB_GLYPH.flail],
  [/mazza|martello|maglio|scettro/, SUB_GLYPH.mace],
  [/lancia|alabarda|glaivo|falce|tridente|picca/, SUB_GLYPH.polearm],
  [/frusta/, SUB_GLYPH.whip],
  [/spada|lama\b|stocco|scimitarra|sciabola|spadone|fioretto|rapier/, SUB_GLYPH.sword],
];

const WONDROUS_KEYWORDS = [
  [/corona|diadema/, SUB_GLYPH.crown],
  [/amuleto|medaglione|ciondolo|collana|pendente/, SUB_GLYPH.amulet],
  [/mantello|manto|cappa|tabarro/, SUB_GLYPH.cloak],
  [/stivali|scarpe|calzari/, SUB_GLYPH.boots],
  [/guanti|bracciali|manopol/, SUB_GLYPH.gloves],
  [/cintura|fibbia|cinghia/, SUB_GLYPH.belt],
  [/borsa|sacco|sacchetto|marsupio|zainetto/, SUB_GLYPH.bag],
  [/tappeto/, SUB_GLYPH.carpet],
  [/scopa/, SUB_GLYPH.broom],
  [/candela/, SUB_GLYPH.candle],
  [/campana|campanello/, SUB_GLYPH.bell],
  [/specchio/, SUB_GLYPH.mirror],
  [/corno\b/, SUB_GLYPH.horn],
  [/sfera|globo|orbe/, SUB_GLYPH.orb],
  [/spilla|fermaglio/, SUB_GLYPH.brooch],
  [/lente|monocolo|occhiali/, SUB_GLYPH.lens],
  [/libro|tomo|grimorio|manuale/, SUB_GLYPH.book],
  [/cuore\b/, SUB_GLYPH.heart],
];

const GEAR_KEYWORDS = [
  [/zaino/, SUB_GLYPH.backpack],
  [/corda/, SUB_GLYPH.rope],
  [/fiala|boccetta|ampolla|bottiglia|flacone/, SUB_GLYPH.bottle],
  [/cassa|forziere|baule|scrigno/, SUB_GLYPH.chest],
  [/tenda/, SUB_GLYPH.tent],
  [/scala\b/, SUB_GLYPH.ladder],
  [/torcia/, SUB_GLYPH.torch],
  [/lanterna/, SUB_GLYPH.lantern],
  [/libro|tomo|grimorio|manuale/, SUB_GLYPH.book],
  [/borsa|sacco|sacchetto|marsupio/, SUB_GLYPH.bag],
];

const ARMOR_KEYWORDS = [
  [/scudo/, SUB_GLYPH.shield],
  [/scagli[ae] di drago/, SUB_GLYPH.dragonscale],
];

const TOOLS_KEYWORDS = [
  [/cornamusa|liuto|flauto|tamburo|violino|arpa|tromba|zampogna|chitarra|strumento/, SUB_GLYPH.instrument],
  [/grimaldell/, SUB_GLYPH.lockpick],
  [/dadi|carte|gioco/, SUB_GLYPH.dice],
  [/forniture|attrezzi/, SUB_GLYPH.artisan],
];

const MOUNTS_KEYWORDS = [
  [/sella|bardatura|finimenti/, SUB_GLYPH.saddle],
  [/nave|barca|chiatta|carro|carrozza|zattera/, SUB_GLYPH.ship],
  [/cavallo|pony|mulo|cammello|ronzino|destriero|asino/, SUB_GLYPH.horse],
];

const SUBTYPE_TABLES = {
  Weapon: WEAPON_KEYWORDS,
  'Wondrous Items': WONDROUS_KEYWORDS,
  'Adventuring Gear': GEAR_KEYWORDS,
  Armor: ARMOR_KEYWORDS,
  Tools: TOOLS_KEYWORDS,
  'Mounts and Vehicles': MOUNTS_KEYWORDS,
};

function matchKeyword(name, table) {
  const n = (name || '').toLowerCase();
  for (const [re, path] of table) {
    if (re.test(n)) return path;
  }
  return null;
}

function pickGlyph(kind, name) {
  const byCreatureName = CREATURE_NAME_GLYPHS[(name || '').toLowerCase()];
  if (byCreatureName) return byCreatureName;
  const table = SUBTYPE_TABLES[kind];
  if (table) {
    const matched = matchKeyword(name, table);
    if (matched) return matched;
  }
  return CREATURE_GLYPHS[kind] || ITEM_GLYPHS[kind];
}

function Glyph({ d }) {
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute h-[65%] w-[65%] text-white/15"
    >
      <path d={d} />
    </svg>
  );
}

function Placeholder({ name, glyph, className }) {
  const h = hashStr(name || 'sconosciuto');
  const [c1, c2] = PALETTES[h % PALETTES.length];
  return (
    <div
      className={`${className} relative flex items-center justify-center overflow-hidden font-bold text-2xl text-white/80`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      <Glyph d={glyph} />
      <span className="relative">{initials(name || '?')}</span>
    </div>
  );
}

// Used when a creature/item has no real artwork (or it fails to load): a
// deterministic, seeded gradient "icon" with a name/keyword-aware glyph plus
// initials, so every entry still visually hints at what it is.
export default function EntityImage({ src, name, kind, className }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const glyph = pickGlyph(kind, name);
    return <Placeholder name={name} glyph={glyph} className={className} />;
  }
  return (
    <img
      src={src}
      alt={name}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
