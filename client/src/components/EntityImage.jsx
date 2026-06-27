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

function Placeholder({ name, className }) {
  const h = hashStr(name || 'sconosciuto');
  const [c1, c2] = PALETTES[h % PALETTES.length];
  return (
    <div
      className={`${className} flex items-center justify-center font-bold text-2xl text-white/80`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      {initials(name || '?')}
    </div>
  );
}

// Used when a creature/item has no real artwork (or it fails to load): a
// deterministic, seeded gradient "icon" so every entry still visually has
// a "photo" placeholder.
export default function EntityImage({ src, name, className }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <Placeholder name={name} className={className} />;
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
