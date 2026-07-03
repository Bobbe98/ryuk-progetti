import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const CARDS = [
  { to: '/creature', title: 'Bestiario', statKey: 'creatures', desc: 'Sfoglia, filtra e ordina tutte le creature per Grado di Sfida, tipo e habitat. Aggiungi le tue creature homebrew.', icon: 'M7 9a2 2 0 1 1 0 .1M17 9a2 2 0 1 1 0 .1M12 11c-3 0-5 2-5 4.5S9 19 12 19s5-1 5-3.5S15 11 12 11Z' },
  { to: '/oggetti', title: 'Oggetti', statKey: 'items', desc: 'Armi, armature e oggetti magici per rarità e categoria, con materiali e procedura di creazione.', icon: 'M5 19 16 8M14 4l6 6-2 2-6-6 2-2ZM3 21l3-1 1-3-3 1-1 3Z' },
  { to: '/incantesimi', title: 'Incantesimi', statKey: 'spells', desc: 'Tutti gli incantesimi con testi ufficiali in italiano: filtra per classe, livello, scuola, rituali e concentrazione.', icon: 'M14 3l1.5 3.5L19 8l-3.5 1.5L14 13l-1.5-3.5L9 8l3.5-1.5L14 3ZM6 13l1 2.5L9.5 16 7 17l-1 2.5L5 17l-2.5-1L5 15.5 6 13Z' },
  { to: '/preferiti', title: 'Preferiti e liste', desc: 'Metti una stella a ciò che ti serve e prepara liste per la prossima sessione, salvate sul dispositivo.', icon: 'M12 3l2.5 5.5 6 .7-4.5 4 1.3 5.8L12 16l-5.3 3 1.3-5.8-4.5-4 6-.7L12 3Z' },
  { to: '/incontri', title: 'Generatore di incontri', desc: 'Genera incontri casuali in base al Grado di Sfida desiderato e all\'ambiente, oppure calcola il budget XP del gruppo.', icon: 'M5 5l6 6M9 3 3 9M14 14l6 6M21 15l-6 6M13 6l5 5M6 13l5 5' },
  { to: '/negozi', title: 'Generatore di negozi', desc: 'Genera negozi casuali con inventario coerente in base al mestiere del mercante.', icon: 'M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9M9 20v-6h6v6' },
];

export default function HomePage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      api.creatures({ pageSize: 1 }),
      api.items({ pageSize: 1 }),
      api.spells({ pageSize: 1 }),
    ]).then(([c, i, s]) => setStats({ creatures: c.total, items: i.total, spells: s.total })).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="animate-rise text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" className="mx-auto h-16 w-16 text-amber-400 drop-shadow-[0_0_18px_rgba(251,191,36,0.45)]">
          <path d="M12 2l8.5 6v8L12 22l-8.5-6V8L12 2Z" />
          <path d="M12 2v7.5M3.5 8l8.5 1.5L20.5 8M12 22v-6M12 16l-8.5-6M12 16l8.5-6" opacity="0.55" />
        </svg>
        <h1 className="font-display mt-4 text-4xl font-bold tracking-wide sm:text-5xl">
          <span className="bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 bg-clip-text text-transparent">Compendio D&amp;D 5e</span>
        </h1>
        <div className="rule-ornate mx-auto mt-5 w-64" />
        <p className="mx-auto mt-5 max-w-2xl text-zinc-400">
          Creature, oggetti e incantesimi del System Reference Document 5.1 interamente in italiano,
          pronti per essere ampliati con il tuo contenuto homebrew. Tira i dadi toccando le formule,
          genera incontri e negozi, prepara le tue sessioni.
        </p>
      </div>

      <div className="animate-rise-1 mx-auto mt-8 grid max-w-xl grid-cols-3 gap-3 text-center">
        <Stat value={stats?.creatures} label="Creature" />
        <Stat value={stats?.items} label="Oggetti" />
        <Stat value={stats?.spells} label="Incantesimi" />
      </div>

      <div className="animate-rise-2 mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link key={c.to} to={c.to} className="card group p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-400 transition group-hover:border-amber-400/50 group-hover:shadow-[0_0_12px_rgba(251,191,36,0.25)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d={c.icon} />
                </svg>
              </span>
              <h2 className="font-display text-lg font-semibold text-amber-200 group-hover:text-amber-300">{c.title}</h2>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="card p-3">
      <div className="font-display text-2xl font-bold text-amber-300">{value ?? '—'}</div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
