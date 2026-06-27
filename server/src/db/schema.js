export const SCHEMA = `
CREATE TABLE IF NOT EXISTS creatures (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'homebrew', -- 'srd' | 'homebrew'
  name TEXT NOT NULL,
  size TEXT,
  type TEXT,
  subtype TEXT,
  alignment TEXT,
  ac INTEGER,
  ac_detail TEXT,
  hp INTEGER,
  hit_dice TEXT,
  speed TEXT,
  str INTEGER, dex INTEGER, con INTEGER, intl INTEGER, wis INTEGER, cha INTEGER,
  saving_throws TEXT,
  skills TEXT,
  damage_vulnerabilities TEXT,
  damage_resistances TEXT,
  damage_immunities TEXT,
  condition_immunities TEXT,
  senses TEXT,
  languages TEXT,
  cr REAL,
  xp INTEGER,
  proficiency_bonus INTEGER,
  traits TEXT,
  actions TEXT,
  legendary_actions TEXT,
  reactions TEXT,
  environments TEXT,
  image_url TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_creatures_cr ON creatures(cr);
CREATE INDEX IF NOT EXISTS idx_creatures_name ON creatures(name);
CREATE INDEX IF NOT EXISTS idx_creatures_type ON creatures(type);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'homebrew', -- 'srd' | 'homebrew'
  name TEXT NOT NULL,
  category TEXT,
  rarity TEXT,
  rarity_rank INTEGER,
  cost_gp REAL,
  attunement INTEGER DEFAULT 0,
  weight REAL,
  description TEXT,
  properties TEXT,
  crafting_materials TEXT,
  crafting_procedure TEXT,
  image_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_rarity ON items(rarity_rank);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
`;

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'very_rare', 'legendary', 'artifact', 'varies'];

export const RARITY_LABELS_IT = {
  common: 'Comune',
  uncommon: 'Non comune',
  rare: 'Raro',
  very_rare: 'Molto raro',
  legendary: 'Leggendario',
  artifact: 'Artefatto',
  varies: 'Variabile',
};
