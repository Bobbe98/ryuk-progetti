import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import DiceText from '../components/DiceText';
import EntityImage from '../components/EntityImage';
import FavoriteButton from '../components/FavoriteButton';
import CustomizeEditor from '../components/CustomizeEditor';
import { applyOverride } from '../local/overridesStore';
import { SPELL_SCHOOL_LABELS, SPELL_SCHOOL_COLORS, SPELL_CLASS_LABELS, spellLevel } from '../i18n';

export default function SpellDetailPage() {
  const { id } = useParams();
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    setRaw(null);
    api.spell(id).then(setRaw).catch((e) => setError(e.message));
  }, [id]);

  void rev; // re-applies the override after each save/restore
  const spell = raw && applyOverride('spell', raw);

  if (error) return <div className="mx-auto max-w-3xl px-4 py-8 text-red-400">{error}</div>;
  if (!spell) return <div className="mx-auto max-w-3xl px-4 py-8"><div className="skeleton h-64 rounded-xl" /></div>;

  const typeLine = spell.level === 0
    ? `Trucchetto di ${(SPELL_SCHOOL_LABELS[spell.school] || spell.school || '').toLowerCase()}`
    : `${SPELL_SCHOOL_LABELS[spell.school] || spell.school} di ${spell.level}° livello`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/incantesimi" className="text-sm text-amber-400">&larr; Torna agli incantesimi</Link>

      <div className="card relative mt-4 overflow-hidden p-6">
        <span className={`absolute inset-x-0 top-0 h-1 ${SPELL_SCHOOL_COLORS[spell.school] || 'bg-zinc-600'}`} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            {spell.image_url && (
              <EntityImage src={spell.image_url} name={spell.name} kind={spell.school} className="h-24 w-24 flex-shrink-0 rounded-lg object-cover" />
            )}
            <div>
              <h1 className="font-display text-3xl font-bold text-amber-300">{spell.name}</h1>
              <p className="mt-0.5 italic text-zinc-400">{typeLine}{spell.ritual ? ' (rituale)' : ''}</p>
              <div className="mt-2">
                <CustomizeEditor kind="spell" entity={spell} onChange={() => setRev((r) => r + 1)} />
              </div>
            </div>
          </div>
          <FavoriteButton kind="spell" id={spell.id} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Meta label="Tempo di lancio" value={spell.casting_time} />
          <Meta label="Gittata" value={spell.range} />
          <Meta label="Componenti" value={spell.components} />
          <Meta label="Durata" value={spell.duration} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {spell.concentration && <span className="rounded bg-purple-900/50 px-2 py-0.5 text-xs text-purple-300">Concentrazione</span>}
          {spell.ritual && <span className="rounded bg-sky-900/50 px-2 py-0.5 text-xs text-sky-300">Rituale</span>}
          {(spell.classes || []).map((c) => (
            <span key={c} className="rounded bg-white/10 px-2 py-0.5 text-xs text-zinc-300">{SPELL_CLASS_LABELS[c] || c}</span>
          ))}
        </div>

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300">
          {(spell.description || '').split('\n\n').map((p, i) => (
            <p key={i} className={p.startsWith('Ai livelli superiori') ? 'border-l-2 border-amber-600/50 pl-3 italic' : ''}>
              <DiceText text={p} />
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm text-zinc-200">{value}</div>
    </div>
  );
}
