import { Link } from 'react-router-dom';

const CARDS = [
  { to: '/creature', title: 'Bestiario', desc: 'Sfoglia, filtra e ordina tutte le creature per Grado di Sfida, tipo e habitat. Aggiungi le tue creature homebrew.' },
  { to: '/oggetti', title: 'Oggetti', desc: 'Sfoglia, filtra e ordina armi, armature e oggetti magici per rarità e categoria. Ogni oggetto ha materiali e procedura di creazione.' },
  { to: '/incontri', title: 'Generatore di incontri', desc: 'Genera incontri casuali in base al Grado di Sfida desiderato e all\'ambiente, oppure calcola il budget XP del tuo gruppo.' },
  { to: '/negozi', title: 'Generatore di negozi', desc: 'Genera negozi casuali con inventario coerente in base al mestiere del mercante.' },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-amber-300">Compendio D&D 5e</h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        Creature e oggetti del System Reference Document 5.1 (licenza OGL), pronti per essere ampliati con il
        tuo contenuto homebrew. Filtra per Grado di Sfida o rarità, genera incontri e negozi casuali.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-lg border border-white/10 bg-white/5 p-5 transition hover:border-amber-500/50 hover:bg-white/10"
          >
            <h2 className="text-xl font-semibold text-amber-200">{c.title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
