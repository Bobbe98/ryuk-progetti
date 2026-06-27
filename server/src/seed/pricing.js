// SRD magic item entries don't carry a gp cost (only rarity). We derive a
// deterministic-but-varied price from rarity using the price bands
// commonly referenced for buying/selling magic items, seeded by item id
// so re-seeding gives stable prices.
const RARITY_RANGE = {
  common: [50, 100],
  uncommon: [101, 500],
  rare: [501, 5000],
  very_rare: [5001, 50000],
  legendary: [50001, 200000],
  artifact: [500000, 1000000],
  varies: [100, 1000],
};

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function priceForRarity(rarity, seedKey) {
  const [min, max] = RARITY_RANGE[rarity] || RARITY_RANGE.varies;
  const t = hashSeed(seedKey);
  const value = Math.round((min + t * (max - min)) / 10) * 10;
  return value;
}

export const RARITY_KEY_MAP = {
  Common: 'common',
  Uncommon: 'uncommon',
  Rare: 'rare',
  'Very Rare': 'very_rare',
  Legendary: 'legendary',
  Artifact: 'artifact',
  Varies: 'varies',
};

export const RARITY_RANK = {
  common: 0,
  uncommon: 1,
  rare: 2,
  very_rare: 3,
  legendary: 4,
  artifact: 5,
  varies: 1.5,
};
