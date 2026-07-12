// Shared flavour/reward logic for the encounter generator: CR-scaled
// treasure and Italian narrative seeds that turn a monster list into a scene.
// Mirrored in client/src/local/encounterExtras.js for the offline build.

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Rarity band of reward items scales with the strongest creature in the
// encounter, gold scales with the XP budget.
export function rewardPlan(creatures, budget) {
  const maxCr = Math.max(0, ...creatures.map((c) => Number(c.cr) || 0));
  let band;
  if (maxCr < 5) band = ['common', 'uncommon'];
  else if (maxCr < 11) band = ['uncommon', 'rare'];
  else if (maxCr < 17) band = ['rare', 'very_rare'];
  else band = ['very_rare', 'legendary'];
  const gold = Math.max(5, Math.round((budget * (0.8 + Math.random() * 0.6)) / 10));
  const itemCount = Math.random() < 0.25 ? 0 : 1 + Math.floor(Math.random() * 2);
  return { band, gold, itemCount };
}

const NARRATIVE_GOALS = [
  'Le creature difendono un vecchio santuario e attaccano chiunque ne varchi la soglia.',
  'Le creature stanno banchettando con una preda recente: sono distratte, ma feroci se interrotte.',
  'Le creature sorvegliano un prigioniero che implora aiuto a gesti.',
  'Le creature stanno cercando qualcosa nel terreno e non vogliono testimoni.',
  'Le creature tendono un\'imboscata lungo il sentiero: la prima ondata è solo un\'esca.',
  'Le creature proteggono la loro tana e i piccoli nascosti al suo interno.',
  'Le creature sono in fuga da qualcosa di più grande: attraversano la scena in preda al panico.',
  'Le creature esigono un pedaggio: combattono solo se il gruppo rifiuta o tenta di ingannarle.',
  'Le creature stanno saccheggiando un carro rovesciato; i mercanti sopravvissuti sono nascosti lì vicino.',
  'Le creature celebrano un rituale che si completerà tra pochi round, con conseguenze terribili.',
  'Le creature obbediscono a un capo che osserva dall\'ombra e fugge se le cose si mettono male.',
  'Le creature difendono l\'unico guado sicuro per miglia.',
];

const NARRATIVE_TWISTS = [
  'Il terreno è instabile: ogni round qualcosa crolla, frana o si allaga.',
  'La visibilità è pessima (nebbia, fumo o buio): la distanza di ingaggio è dimezzata.',
  'C\'è una via di fuga evidente ma rischiosa che entrambe le parti possono usare.',
  'Un oggetto prezioso è in vista al centro dello scontro: chi lo afferra diventa il bersaglio.',
  'Rinforzi nemici arrivano al 3° round se nessuno dà l\'allarme prima.',
  'Parte del campo di battaglia è consacrata o maledetta: effetti strani per chi vi combatte.',
  'Un innocente è intrappolato nel mezzo: proteggerlo complica ogni mossa.',
  'L\'ambiente offre copertura abbondante: chi resta allo scoperto paga caro.',
  'Una fonte di rumore costante copre i suoni: impossibile sentire chi si avvicina.',
  'Il tempo gioca contro: al tramonto (o all\'alba) le creature diventano più forti o fuggono.',
];

export function narrativeSeed() {
  const goal = NARRATIVE_GOALS[Math.floor(Math.random() * NARRATIVE_GOALS.length)];
  const twist = NARRATIVE_TWISTS[Math.floor(Math.random() * NARRATIVE_TWISTS.length)];
  return `${goal} ${twist}`;
}
