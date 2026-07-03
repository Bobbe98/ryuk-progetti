import { NavLink } from 'react-router-dom';

const ICONS = {
  creature: 'M7 9a2 2 0 1 1 0 .1M17 9a2 2 0 1 1 0 .1M12 11c-3 0-5 2-5 4.5S9 19 12 19s5-1 5-3.5S15 11 12 11Z',
  oggetti: 'M5 19 16 8M14 4l6 6-2 2-6-6 2-2ZM3 21l3-1 1-3-3 1-1 3Z',
  incantesimi: 'M14 3l1.5 3.5L19 8l-3.5 1.5L14 13l-1.5-3.5L9 8l3.5-1.5L14 3ZM6 13l1 2.5L9.5 16 7 17l-1 2.5L5 17l-2.5-1L5 15.5 6 13Z',
  preferiti: 'M12 3l2.5 5.5 6 .7-4.5 4 1.3 5.8L12 16l-5.3 3 1.3-5.8-4.5-4 6-.7L12 3Z',
  incontri: 'M5 5l6 6M9 3 3 9M14 14l6 6M21 15l-6 6M13 6l5 5M6 13l5 5',
  negozi: 'M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9M9 20v-6h6v6',
  impostazioni: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19 12a7 7 0 0 0-.2-1.6l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.8-1.6L13.3 2h-2.6l-.4 2.9a7 7 0 0 0-2.8 1.6l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .55.07 1.08.2 1.6l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.8 1.6l.4 2.9h2.6l.4-2.9a7 7 0 0 0 2.8-1.6l2.3 1 2-3.4-2-1.5c.13-.52.2-1.05.2-1.6Z',
};

const links = [
  { to: '/creature', label: 'Creature', icon: ICONS.creature },
  { to: '/oggetti', label: 'Oggetti', icon: ICONS.oggetti },
  { to: '/incantesimi', label: 'Incantesimi', icon: ICONS.incantesimi },
  { to: '/preferiti', label: 'Preferiti', icon: ICONS.preferiti },
  { to: '/incontri', label: 'Incontri', icon: ICONS.incontri },
  { to: '/negozi', label: 'Negozi', icon: ICONS.negozi },
  { to: '/impostazioni', label: 'Impostazioni', icon: ICONS.impostazioni },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-amber-500/15 bg-[#151119]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <NavLink to="/" className="group flex shrink-0 items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="h-7 w-7 text-amber-400 transition group-hover:drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]">
            <path d="M12 2l8.5 6v8L12 22l-8.5-6V8L12 2Z" />
            <path d="M12 2v7.5M3.5 8l8.5 1.5L20.5 8M12 22v-6M12 16l-8.5-6M12 16l8.5-6" opacity="0.55" />
          </svg>
          <span className="font-display text-lg font-bold tracking-wide">
            <span className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">Compendio 5e</span>
          </span>
        </NavLink>
        <nav className="scrollbar-none -mx-1 flex flex-1 gap-1 overflow-x-auto px-1 text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`
              }
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d={l.icon} />
              </svg>
              <span className="hidden sm:inline">{l.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="rule-ornate opacity-60" />
    </header>
  );
}
