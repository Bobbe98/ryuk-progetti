import { NavLink } from 'react-router-dom';

const links = [
  { to: '/creature', label: 'Creature' },
  { to: '/oggetti', label: 'Oggetti' },
  { to: '/incontri', label: 'Incontri' },
  { to: '/negozi', label: 'Negozi' },
  { to: '/impostazioni', label: 'Impostazioni' },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#1a1722]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <NavLink to="/" className="text-lg font-bold text-amber-400 tracking-wide">
          Compendio 5e
        </NavLink>
        <nav className="flex gap-4 text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded px-3 py-1.5 transition ${isActive ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-300 hover:bg-white/5'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
