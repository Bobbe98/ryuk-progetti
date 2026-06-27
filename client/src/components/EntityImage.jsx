import { useState } from 'react';

const PALETTES = [
  ['#7c2d12', '#1c0a05'], ['#1e3a8a', '#0a1330'], ['#14532d', '#06190f'],
  ['#581c87', '#1a0a26'], ['#854d0e', '#241502'], ['#3f3f46', '#101012'],
  ['#831843', '#220612'],
];

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

// Minimal line-art glyphs (24x24, stroke-based) keyed by creature type /
// item category, drawn as a low-opacity watermark behind the initials so
// every placeholder hints at "what kind of thing this is" at a glance,
// without depending on any external art or generated images.
const CREATURE_GLYPHS = {
  aberration: 'M12 4a4 4 0 0 1 4 4c0 2-1.5 3-1.5 5M8 8a4 4 0 0 1 4-4M6 12c0 4 2.5 7 6 7s6-3 6-7M9 12v3M15 12v3M12 12v4',
  beast: 'M7 9a2 2 0 1 1 0 .1M17 9a2 2 0 1 1 0 .1M9.5 6a1.5 1.5 0 1 1 0 .1M14.5 6a1.5 1.5 0 1 1 0 .1M12 11c-3 0-5 2-5 4.5S9 19 12 19s5-1 5-3.5S15 11 12 11Z',
  celestial: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  construct: 'M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  dragon: 'M3 16c2-1 3-3 3-5 0-1 1-2 2-1 1-3 4-5 7-5 1.5 0 2 1 1.5 2 2 .5 3.5 2 4.5 4-1.5 0-2.5.5-3 1.5-1-1-2.5-1.5-4-1-1 1.5-2.5 2.5-4 2.5L7 17',
  elemental: 'M12 3c3 4 5 7 5 10a5 5 0 1 1-10 0c0-3 2-6 5-10Z',
  fey: 'M12 2c2 4 6 6 6 10a6 6 0 1 1-12 0c0-4 4-6 6-10ZM6 18c2 0 3 1 3 3M18 18c-2 0-3 1-3 3',
  fiend: 'M5 9c0-3 3-6 7-6s7 3 7 6c0 3-2 4-2 6v2H7v-2c0-2-2-3-2-6ZM5 9 2 7M19 9l3-2M9 19v2M15 19v2M9.5 11h.1M14.5 11h.1',
  giant: 'M7 21l3-9-2-3 2-3h4l2 3-2 3 3 9M9 7l-2-4M15 7l2-4',
  humanoid: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 21c0-4.5 2.7-7 6-7s6 2.5 6 7',
  monstrosity: 'M4 10c2-4 5-6 8-6s6 2 8 6c-2 1-2 3-1 5-2 1-4 1-5-1-1 2-3 2-4 0-1 2-3 2-5 1 1-2 1-4-1-5Z',
  ooze: 'M12 4c3 3 6 7 6 10.5A6 6 0 0 1 6 14.5C6 11 9 7 12 4Zm-2 9h.1m3.9 1h.1',
  plant: 'M12 21V9M12 9C9 9 6 7 6 4c3 0 5 1.5 6 3.5C13 5.5 15 4 18 4c0 3-3 5-6 5ZM8 14c1.5 1 2.5 2 4 2M16 17c-1.5 1-2.5 1.5-4 1.5',
  undead: 'M12 3a7 7 0 0 0-7 7c0 2.5 1.3 4 2 5v3h3v-2h4v2h3v-3c.7-1 2-2.5 2-5a7 7 0 0 0-7-7ZM9.5 10h.1M14.5 10h.1M10 14h4',
  'swarm of Tiny beasts': 'M6 8h.1M10 6h.1M15 7h.1M18 10h.1M5 13h.1M9 14h.1M13 13h.1M17 15h.1M7 18h.1M12 18h.1M16 19h.1',
};

const ITEM_GLYPHS = {
  Weapon: 'M5 19 16 8M14 4l6 6-2 2-6-6 2-2ZM3 21l3-1 1-3-3 1-1 3Z',
  Armor: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z',
  Ammunition: 'M4 20 18 6M14 4l6 2-2 6-2-2 2-2-2-2-2 2-2-2ZM4 20l3-1-1-2-2 3Z',
  'Wondrous Items': 'M12 2l1.8 5.6H19l-4.6 3.4 1.8 5.6L12 13.2 7.8 16.6l1.8-5.6L5 8h5.2L12 2Z',
  Ring: 'M12 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM9 6l3-4 3 4',
  Rod: 'M6 19 17 6M5 21l2-3 2 1-2 3ZM16 5l2-2 2 2-2 2Z',
  Potion: 'M10 2h4M11 2v5L7 14a4 4 0 0 0 4 7h2a4 4 0 0 0 4-7l-4-7V2ZM8.5 15h7',
  Scroll: 'M6 4h12v4a2 2 0 0 0 0 4 2 2 0 0 0 0 4v4H6a2 2 0 0 1 0-4 2 2 0 0 1 0-4 2 2 0 0 1 0-4V4ZM9 8h6M9 12h6',
  Staff: 'M7 21 16 4M16 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  Wand: 'M5 19 14 10M16 4l1.5 3L21 8.5 17.5 10 16 13l-1.5-3L11 8.5 14.5 7 16 4Z',
  'Adventuring Gear': 'M7 9V7a5 5 0 0 1 10 0v2M5 9h14l-1 12H6L5 9ZM9 12v4M15 12v4',
  Tools: 'M14 7l3-3 2 2-3 3 1 1-7 7-3-3 7-7 1 1ZM5 19l3-1 1-2-2-2-2 2 1 1-2 2 1 1Z',
  'Mounts and Vehicles': 'M5 18a3 3 0 1 0 0 .1M19 18a3 3 0 1 0 0 .1M5 18h14M7 18V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v9',
};

function Glyph({ d }) {
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute h-[65%] w-[65%] text-white/15"
    >
      <path d={d} />
    </svg>
  );
}

function Placeholder({ name, glyph, className }) {
  const h = hashStr(name || 'sconosciuto');
  const [c1, c2] = PALETTES[h % PALETTES.length];
  return (
    <div
      className={`${className} relative flex items-center justify-center overflow-hidden font-bold text-2xl text-white/80`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      <Glyph d={glyph} />
      <span className="relative">{initials(name || '?')}</span>
    </div>
  );
}

// Used when a creature/item has no real artwork (or it fails to load): a
// deterministic, seeded gradient "icon" with a category/type glyph plus
// initials, so every entry still visually hints at what it is.
export default function EntityImage({ src, name, kind, className }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const glyph = CREATURE_GLYPHS[kind] || ITEM_GLYPHS[kind];
    return <Placeholder name={name} glyph={glyph} className={className} />;
  }
  return (
    <img
      src={src}
      alt={name}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
