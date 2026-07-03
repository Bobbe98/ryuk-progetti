export const TYPE_LABELS = {
  aberration: 'Aberrazione', beast: 'Bestia', celestial: 'Celestiale', construct: 'Costrutto',
  dragon: 'Drago', elemental: 'Elementale', fey: 'Fata', fiend: 'Demone/Diavolo', giant: 'Gigante',
  humanoid: 'Umanoide', monstrosity: 'Mostruosità', ooze: 'Melma', plant: 'Pianta', undead: 'Non-morto',
  'swarm of Tiny beasts': 'Sciame di bestie minuscole',
};

export const SIZE_LABELS = {
  Tiny: 'Minuscola', Small: 'Piccola', Medium: 'Media', Large: 'Grande', Huge: 'Enorme', Gargantuan: 'Mastodontica',
};

export const ENVIRONMENT_LABELS = {
  artico: 'Artico', costiero: 'Costiero', deserto: 'Deserto', foresta: 'Foresta', pianura: 'Pianura',
  collina: 'Collina', montagna: 'Montagna', palude: 'Palude', sotterraneo: 'Sotterraneo',
  sottosuolo: 'Sottosuolo', acquatico: 'Acquatico', urbano: 'Urbano', planare: 'Planare',
};

export const RARITY_LABELS = {
  common: 'Comune', uncommon: 'Non comune', rare: 'Raro', very_rare: 'Molto raro',
  legendary: 'Leggendario', artifact: 'Artefatto', varies: 'Variabile',
};

export const RARITY_COLORS = {
  common: 'bg-zinc-600', uncommon: 'bg-emerald-700', rare: 'bg-blue-700',
  very_rare: 'bg-purple-700', legendary: 'bg-orange-700', artifact: 'bg-rose-800', varies: 'bg-slate-600',
};

export const CATEGORY_LABELS = {
  Weapon: 'Arma', Armor: 'Armatura', Ammunition: 'Munizioni', 'Wondrous Items': 'Oggetto meraviglioso',
  Ring: 'Anello', Rod: 'Bastone', Potion: 'Pozione', Scroll: 'Pergamena', Staff: 'Bastone magico',
  Wand: 'Bacchetta', 'Adventuring Gear': "Attrezzatura d'avventura", Tools: 'Strumenti',
  'Mounts and Vehicles': 'Cavalcature e veicoli',
};

export const SPELL_SCHOOL_LABELS = {
  abjuration: 'Abiurazione', conjuration: 'Evocazione', divination: 'Divinazione',
  enchantment: 'Ammaliamento', evocation: 'Invocazione', illusion: 'Illusione',
  necromancy: 'Necromanzia', transmutation: 'Trasmutazione',
};

export const SPELL_SCHOOL_COLORS = {
  abjuration: 'bg-sky-800', conjuration: 'bg-amber-800', divination: 'bg-indigo-800',
  enchantment: 'bg-pink-800', evocation: 'bg-red-800', illusion: 'bg-violet-800',
  necromancy: 'bg-lime-900', transmutation: 'bg-teal-800',
};

export const SPELL_CLASS_LABELS = {
  bard: 'Bardo', cleric: 'Chierico', druid: 'Druido', paladin: 'Paladino',
  ranger: 'Ranger', sorcerer: 'Stregone', warlock: 'Warlock', wizard: 'Mago',
};

export function spellLevel(level) {
  return level === 0 ? 'Trucchetto' : `${level}° livello`;
}

export function cr(value) {
  if (value === 0) return '0';
  if (value === 0.125) return '1/8';
  if (value === 0.25) return '1/4';
  if (value === 0.5) return '1/2';
  return String(value);
}
