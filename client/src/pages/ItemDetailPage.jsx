import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import EntityImage from '../components/EntityImage';
import { CATEGORY_LABELS, RARITY_LABELS, RARITY_COLORS } from '../i18n';

export default function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setItem(null);
    api.item(id).then(setItem).catch((e) => setError(e.message));
  }, [id]);

  async function handleDelete() {
    if (!confirm(`Eliminare definitivamente "${item.name}"?`)) return;
    await api.deleteItem(id);
    navigate('/oggetti');
  }

  if (error) return <div className="mx-auto max-w-4xl px-4 py-8 text-red-400">{error}</div>;
  if (!item) return <div className="mx-auto max-w-4xl px-4 py-8 text-zinc-400">Caricamento...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/oggetti" className="text-sm text-amber-400">&larr; Torna agli oggetti</Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <EntityImage src={item.image_url} name={item.name} kind={item.category} className="h-56 w-56 flex-shrink-0 rounded-lg object-cover" />
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-amber-300">{item.name}</h1>
          <p className="mt-1 text-zinc-400">{CATEGORY_LABELS[item.category] || item.category}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs text-white ${RARITY_COLORS[item.rarity] || 'bg-zinc-600'}`}>
              {RARITY_LABELS[item.rarity] || item.rarity}
            </span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{Math.round(item.cost_gp)} mo</span>
            {item.weight != null && <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{item.weight} lb</span>}
            {item.attunement && <span className="rounded bg-purple-900/50 px-2 py-0.5 text-xs text-purple-300">Richiede sintonia</span>}
            {item.source === 'homebrew' && <span className="rounded bg-amber-700/40 px-2 py-0.5 text-xs text-amber-300">Homebrew</span>}
          </div>

          {item.source === 'homebrew' && (
            <div className="mt-2 flex gap-2">
              <Link to={`/oggetti/${id}/modifica`} className="rounded bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20">Modifica</Link>
              <button onClick={handleDelete} className="rounded bg-red-900/50 px-2 py-0.5 text-xs hover:bg-red-800/60">Elimina</button>
            </div>
          )}

          <p className="mt-3 whitespace-pre-line text-sm text-zinc-300">{item.description}</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-amber-300">Creazione: materiali e procedura</h2>
        {item.crafting_materials?.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-zinc-300">
            {item.crafting_materials.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        )}
        <p className="mt-3 text-sm text-zinc-400">{item.crafting_procedure}</p>
      </div>
    </div>
  );
}
