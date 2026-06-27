// Mirrors server/src/seed/crafting.js, used to auto-generate a "materiali e
// procedura" recipe for homebrew items created on-device when left blank.
const RARITY_DAYS = {
  common: 5, uncommon: 10, rare: 25, very_rare: 50, legendary: 100, artifact: 250, varies: 25,
};

const RARITY_DC = {
  common: 10, uncommon: 13, rare: 16, very_rare: 19, legendary: 22, artifact: 25, varies: 16,
};

const CATEGORY_MATERIALS = {
  Weapon: ['lega metallica pura (acciaio, mithral o adamantio)', 'carbone da forgia', 'olio per affilatura', 'manico in legno duro o osso intagliato'],
  Armor: ['pelle conciata o lamine metalliche', 'fibbie e cinghie in cuoio rinforzato', 'imbottitura interna', 'rivetti e anelli di giunzione'],
  Ammunition: ['fusti in legno dritto', 'punte metalliche', 'piume per la stabilizzazione', 'resina collante'],
  'Wondrous Items': ['componente arcano raro legato all\'effetto dell\'oggetto', 'polvere di cristallo macinato', 'inchiostro o pigmento incantato', 'base in metallo, legno o osso finemente lavorato'],
  Ring: ['lega di metallo prezioso (oro, argento o platino)', 'gemma focalizzante', 'incisioni runiche'],
  Rod: ['asta di metallo o legno pregiato', 'nucleo cristallino focalizzante', 'fasce metalliche decorate'],
  Potion: ['erbe e funghi rari', 'acqua pura o distillata', 'fiala di vetro soffiato', 'catalizzatore alchemico'],
  Scroll: ['pergamena conciata', 'inchiostro arcano speciale', 'sigillo di ceralacca incantata'],
  Staff: ['lungo ramo di legno sacro o metallo lavorato', 'nucleo di energia magica cristallizzato', 'fasce di rinforzo metalliche'],
  Wand: ['bacchetta in legno raro o osso', 'nucleo focalizzante (gemma, capello di creatura magica, polvere di mithral)'],
  'Adventuring Gear': ['materiali grezzi comuni (corda, cuoio, metallo, legno)', 'strumenti dell\'artigiano pertinenti'],
  Tools: ['materiali grezzi di alta qualità', 'attrezzi dell\'artigiano specifici per il mestiere'],
  'Mounts and Vehicles': ['legno strutturale, metallo e corde', 'manodopera specializzata di carpentiere/fabbro'],
};

function craftingDc(rarity) {
  return RARITY_DC[rarity] ?? 15;
}

export function generateCrafting(category, rarity, name) {
  const days = RARITY_DAYS[rarity] ?? 20;
  const dc = craftingDc(rarity);
  const materials = CATEGORY_MATERIALS[category] || CATEGORY_MATERIALS['Adventuring Gear'];
  const isMagic = rarity && rarity !== 'common';
  const procedure = isMagic
    ? `Regola homebrew di creazione: realizzare "${name}" richiede circa ${days} giorni di lavoro in tempo libero (downtime), un laboratorio o una postazione da artigiano adeguata e una prova di Intelligenza o Saggezza (a seconda dello strumento utilizzato) con CD ${dc} al termine del lavoro. In caso di fallimento l'oggetto non si attiva e occorre ripetere metà del tempo di lavorazione dopo aver individuato l'errore. Per oggetti rari o superiori è inoltre richiesta la conoscenza di un incantesimo o rituale collegato all'effetto dell'oggetto (es. tramite Decifrare Magie o l'assistenza di un lanciatore di incantesimi).`
    : `Procedura: lavorazione artigianale standard, circa ${days} giorni-lavoro con gli strumenti dell'artigiano appropriati e una prova di abilità con CD ${dc}.`;
  return {
    crafting_materials: materials,
    crafting_procedure: procedure,
  };
}
