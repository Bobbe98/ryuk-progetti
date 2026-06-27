// Heuristic environment ("habitat") tagging for SRD monsters.
// The SRD stat-block data does not include official habitat tags, so we
// infer plausible ones from type/subtype/name keywords, mirroring the
// environment categories used by the DMG random-encounter tables.
export const ENVIRONMENTS = [
  'artico',
  'costiero',
  'deserto',
  'foresta',
  'pianura',
  'collina',
  'montagna',
  'palude',
  'sotterraneo',
  'sottosuolo',
  'acquatico',
  'urbano',
  'planare',
];

const KEYWORD_RULES = [
  [/dragon turtle|merfolk|triton|reef|sahuagin|water elemental|sea hag/i, ['costiero', 'acquatico']],
  [/shark|octopus|eel|fish|kraken|sea|merrow|hydra/i, ['acquatico', 'costiero']],
  [/camel|jackal|scorpion|mummy|sphinx|blue dragon|jackalwere/i, ['deserto']],
  [/polar|yeti|mammoth|remorhaz|winter wolf|white dragon|ice/i, ['artico']],
  [/giant (spider|toad|frog|leech)|lizardfolk|bullywug|black dragon|will-o-wisp|shambling mound/i, ['palude', 'sotterraneo']],
  [/owlbear|awakened tree|blink dog|centaur|dryad|green dragon|treant|boar|elk|stag|wolf/i, ['foresta']],
  [/goat|goblin|hobgoblin|orc|ogre|griffon|stone giant|hill giant|frost giant|roc|hippogriff/i, ['collina', 'montagna']],
  [/dwarf|red dragon|fire giant|salamander|azer|hell hound|magma/i, ['montagna', 'sotterraneo']],
  [/bat|cave|otyugh|carrion crawler|grick|purple worm|umber hulk|drow|duergar|mind flayer|beholder|gelatinous cube|rust monster|svirfneblin|underdark/i, ['sotterraneo', 'sottosuolo']],
  [/rat|cat|dog|pigeon|commoner|guard|noble|bandit|cultist|spy|thug|gladiator|cult/i, ['urbano']],
  [/devil|demon|fiend|imp|quasit/i, ['planare', 'sotterraneo']],
  [/angel|deva|couatl|celestial|unicorn/i, ['planare', 'pianura']],
  [/elemental.*air|djinni|invisible stalker/i, ['planare']],
  [/elemental.*fire|fire elemental|magmin/i, ['montagna', 'planare']],
  [/elemental.*earth|earth elemental|xorn/i, ['sotterraneo', 'planare']],
  [/elemental.*water|water elemental/i, ['acquatico', 'planare']],
  [/horse|pony|donkey|mule|cow|sheep|chicken|mastiff/i, ['pianura', 'urbano']],
  [/bear|deer|elk|wolf|panther|lion|tiger/i, ['foresta', 'collina']],
  [/zombie|skeleton|ghoul|ghost|wraith|specter|vampire|wight/i, ['urbano', 'sotterraneo']],
  [/lich|banshee/i, ['urbano', 'planare']],
];

const TYPE_DEFAULTS = {
  aberration: ['sotterraneo', 'planare'],
  beast: ['foresta', 'pianura'],
  celestial: ['planare'],
  construct: ['urbano', 'sotterraneo'],
  dragon: ['montagna', 'collina'],
  elemental: ['planare'],
  fey: ['foresta'],
  fiend: ['planare', 'sotterraneo'],
  giant: ['collina', 'montagna'],
  humanoid: ['urbano', 'pianura'],
  monstrosity: ['sotterraneo', 'montagna'],
  ooze: ['sotterraneo', 'palude'],
  plant: ['foresta', 'palude'],
  undead: ['sotterraneo', 'urbano'],
};

export function inferEnvironments(monster) {
  const found = new Set();
  for (const [re, envs] of KEYWORD_RULES) {
    if (re.test(monster.name) || re.test(monster.subtype || '')) {
      envs.forEach((e) => found.add(e));
    }
  }
  if (found.size === 0) {
    const defaults = TYPE_DEFAULTS[monster.type] || ['pianura'];
    defaults.forEach((e) => found.add(e));
  }
  return [...found];
}
