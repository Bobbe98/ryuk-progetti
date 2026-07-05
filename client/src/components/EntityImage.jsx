import { useState } from 'react';
import { iconFor } from '../lib/entityIcons';
import { bundledArtFor } from '../lib/srdArt';

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

// Illustration shown when an entry has no real artwork (or it fails to load):
// a deterministic seeded gradient plus a bundled game-icons.net icon matched
// to the entry's Italian name / category / creature type, so every creature
// and item always has a meaningful image, even fully offline.
function Placeholder({ name, kind, className }) {
  const h = hashStr(name || 'sconosciuto');
  const [c1, c2] = PALETTES[h % PALETTES.length];
  const icon = iconFor(kind, name);
  return (
    <div
      className={`${className} relative flex items-center justify-center overflow-hidden`}
      style={{ background: `radial-gradient(ellipse at 30% 20%, ${c1}, ${c2})` }}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          aria-hidden
          className="h-[68%] w-[68%] object-contain opacity-90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
        />
      ) : (
        <span className="font-bold text-2xl text-white/80">{initials(name || '?')}</span>
      )}
    </div>
  );
}

export default function EntityImage({ src, name, kind, className }) {
  const [failed, setFailed] = useState(false);
  // Prefer the bundled offline copy of the artwork; hit the network only for
  // URLs we don't ship (e.g. custom homebrew image links).
  const effective = bundledArtFor(src) || src;
  if (!effective || failed) {
    return <Placeholder name={name} kind={kind} className={className} />;
  }
  return (
    <img
      src={effective}
      alt={name}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
