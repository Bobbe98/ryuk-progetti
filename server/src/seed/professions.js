// Configuration for the random shop generator: each "mestiere" (trade)
// defines which item categories it stocks, the rarity weighting of its
// stock, how many items to generate and a price markup range.
export const PROFESSIONS = {
  fabbro: {
    label: 'Fabbro',
    categories: ['Weapon', 'Armor', 'Ammunition'],
    rarityWeights: { common: 70, uncommon: 25, rare: 5 },
    stockRange: [6, 12],
    markup: [0.9, 1.2],
  },
  armaiolo: {
    label: 'Armaiolo',
    categories: ['Armor', 'Weapon'],
    rarityWeights: { common: 50, uncommon: 35, rare: 12, very_rare: 3 },
    stockRange: [5, 10],
    markup: [1.0, 1.3],
  },
  alchimista: {
    label: 'Alchimista',
    categories: ['Potion', 'Scroll'],
    rarityWeights: { common: 40, uncommon: 40, rare: 18, very_rare: 2 },
    stockRange: [6, 14],
    markup: [0.9, 1.4],
  },
  incantatore: {
    label: 'Incantatore (negozio di magia)',
    categories: ['Wand', 'Staff', 'Rod', 'Ring', 'Scroll', 'Wondrous Items'],
    rarityWeights: { uncommon: 45, rare: 35, very_rare: 15, legendary: 5 },
    stockRange: [4, 9],
    markup: [1.1, 1.6],
  },
  mercante_generico: {
    label: 'Mercante generico',
    categories: ['Adventuring Gear', 'Tools', 'Mounts and Vehicles'],
    rarityWeights: { common: 95, uncommon: 5 },
    stockRange: [8, 16],
    markup: [0.85, 1.15],
  },
  erborista: {
    label: 'Erborista',
    categories: ['Potion', 'Adventuring Gear'],
    rarityWeights: { common: 60, uncommon: 35, rare: 5 },
    stockRange: [5, 10],
    markup: [0.9, 1.2],
  },
  gioielliere: {
    label: 'Gioielliere',
    categories: ['Ring', 'Wondrous Items'],
    rarityWeights: { common: 20, uncommon: 40, rare: 30, very_rare: 10 },
    stockRange: [3, 7],
    markup: [1.1, 1.5],
  },
  stalliere: {
    label: 'Stalliere / mercante di cavalcature',
    categories: ['Mounts and Vehicles', 'Adventuring Gear'],
    rarityWeights: { common: 100 },
    stockRange: [3, 6],
    markup: [0.9, 1.1],
  },
  ciarlatano: {
    label: 'Ciarlatano / mercato nero',
    categories: ['Wondrous Items', 'Ring', 'Potion', 'Scroll', 'Weapon'],
    rarityWeights: { common: 20, uncommon: 30, rare: 30, very_rare: 15, legendary: 5 },
    stockRange: [4, 8],
    markup: [0.6, 2.0],
  },
};
