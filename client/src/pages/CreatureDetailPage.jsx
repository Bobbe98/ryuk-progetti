import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import EntityImage from '../components/EntityImage';
import { TYPE_LABELS, SIZE_LABELS, ENVIRONMENT_LABELS, cr } from '../i18n';

function mod(score) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

const ABILITIES = [
  ['str', 'FOR'], ['dex', 'DES'], ['con', 'COS'], ['intl', 'INT'], ['wis', 'SAG'], ['cha', 'CAR'],
];

export default function CreatureDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [creature, setCreature] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCreature(null);
    api.creature(id).then(setCreature).catch((e) => setError(e.message));
  }, [id]);

  async function handleDelete() {
    if (!confirm(`Eliminare definitivamente "${creature.name}"?`)) return;
    await api.deleteCreature(id);
    navigate('/creature');
  }

  if (error) return <div className="mx-auto max-w-4xl px-4 py-8 text-red-400">{error}</div>;
  if (!creature) return <div className="mx-auto max-w-4xl px-4 py-8 text-zinc-400">Caricamento...</div>;

  const speed = creature.speed || {};
  const senses = creature.senses || {};

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/creature" className="text-sm text-amber-400">&larr; Torna al bestiario</Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <EntityImage src={creature.image_url} name={creature.name} kind={creature.type} className="h-56 w-56 flex-shrink-0 rounded-lg object-cover" />
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-amber-300">{creature.name}</h1>
          <p className="italic text-zinc-400">
            {SIZE_LABELS[creature.size] || creature.size} {TYPE_LABELS[creature.type] || creature.type}
            {creature.subtype ? ` (${creature.subtype})` : ''}, {creature.alignment}
          </p>
          {creature.source === 'homebrew' && (
            <div className="mt-2 flex gap-2">
              <span className="inline-block rounded bg-amber-700/40 px-2 py-0.5 text-xs text-amber-300">Homebrew</span>
              <Link to={`/creature/${id}/modifica`} className="rounded bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20">Modifica</Link>
              <button onClick={handleDelete} className="rounded bg-red-900/50 px-2 py-0.5 text-xs hover:bg-red-800/60">Elimina</button>
            </div>
          )}
          <p className="mt-3 text-sm text-zinc-300">{creature.description}</p>

          {creature.environments?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {creature.environments.map((e) => (
                <span key={e} className="rounded bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">{ENVIRONMENT_LABELS[e] || e}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Classe Armatura" value={creature.ac} />
        <Stat label="Punti Ferita" value={`${creature.hp} (${creature.hit_dice})`} />
        <Stat label="Grado di Sfida" value={`${cr(creature.cr)} (${creature.xp} PE)`} />
        <Stat label="Velocità" value={Object.entries(speed).filter(([k]) => k !== 'hover').map(([k, v]) => `${k} ${v}`).join(', ')} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map(([key, label]) => (
          <div key={key} className="rounded border border-white/10 bg-white/5 p-2 text-center">
            <div className="text-xs text-zinc-400">{label}</div>
            <div className="font-semibold">{creature[key]} ({mod(creature[key])})</div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 text-sm text-zinc-300">
        {Object.keys(creature.saving_throws || {}).length > 0 && (
          <p><span className="text-zinc-500">Tiri Salvezza: </span>{Object.entries(creature.saving_throws).map(([k, v]) => `${k} +${v}`).join(', ')}</p>
        )}
        {Object.keys(creature.skills || {}).length > 0 && (
          <p><span className="text-zinc-500">Abilità: </span>{Object.entries(creature.skills).map(([k, v]) => `${k} +${v}`).join(', ')}</p>
        )}
        {creature.damage_vulnerabilities?.length > 0 && <p><span className="text-zinc-500">Vulnerabilità: </span>{creature.damage_vulnerabilities.join(', ')}</p>}
        {creature.damage_resistances?.length > 0 && <p><span className="text-zinc-500">Resistenze: </span>{creature.damage_resistances.join(', ')}</p>}
        {creature.damage_immunities?.length > 0 && <p><span className="text-zinc-500">Immunità ai danni: </span>{creature.damage_immunities.join(', ')}</p>}
        {creature.condition_immunities?.length > 0 && <p><span className="text-zinc-500">Immunità alle condizioni: </span>{creature.condition_immunities.join(', ')}</p>}
        {Object.keys(senses).length > 0 && <p><span className="text-zinc-500">Sensi: </span>{Object.entries(senses).map(([k, v]) => `${k} ${v}`).join(', ')}</p>}
        {creature.languages && <p><span className="text-zinc-500">Linguaggi: </span>{creature.languages}</p>}
      </div>

      <Section title="Tratti" items={creature.traits} />
      <Section title="Azioni" items={creature.actions} />
      <Section title="Azioni Leggendarie" items={creature.legendary_actions} />
      <Section title="Reazioni" items={creature.reactions} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-white/10 bg-white/5 p-3 text-center">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function Section({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="border-b border-amber-700/40 pb-1 text-lg font-semibold text-amber-300">{title}</h2>
      <div className="mt-2 space-y-2 text-sm">
        {items.map((it, i) => (
          <p key={i}><span className="font-semibold italic">{it.name}.</span> {it.desc}</p>
        ))}
      </div>
    </div>
  );
}
