import { useState } from 'react';
import { overridesStore } from '../local/overridesStore';

// Reads a picked image file and returns a downscaled JPEG data URL so custom
// artwork can be stored on-device (offline-safe) without eating storage.
function fileToDataUrl(file, cb) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, 512 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    cb(canvas.toDataURL('image/jpeg', 0.85));
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

// "Personalizza" panel shown on SRD detail pages (and all spells): lets the
// user override description and image. Overrides live on the device and are
// reversible; homebrew entries keep their existing full edit form instead.
export default function CustomizeEditor({ kind, entity, onChange }) {
  const [open, setOpen] = useState(false);
  const override = overridesStore.get(kind, entity.id);
  const [desc, setDesc] = useState(null); // null = not touched yet
  const [imageUrl, setImageUrl] = useState(null);

  const curDesc = desc ?? entity.description ?? '';
  const curImage = imageUrl ?? override?.image_url ?? '';

  function save() {
    overridesStore.set(kind, entity.id, {
      description: desc !== null ? desc : undefined,
      image_url: imageUrl !== null ? imageUrl : undefined,
    });
    setOpen(false);
    setDesc(null);
    setImageUrl(null);
    onChange?.();
  }

  function restore() {
    if (!confirm('Ripristinare descrizione e immagine originali?')) return;
    overridesStore.clear(kind, entity.id);
    setOpen(false);
    setDesc(null);
    setImageUrl(null);
    onChange?.();
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (file) fileToDataUrl(file, setImageUrl);
    e.target.value = '';
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="rounded bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
        >
          ✎ Personalizza
        </button>
        {entity.customized && (
          <span className="rounded bg-sky-900/50 px-2 py-0.5 text-xs text-sky-300" title="Descrizione o immagine personalizzata su questo dispositivo">
            Personalizzato
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="card mt-3 w-full p-4">
      <h3 className="font-display text-sm font-semibold text-amber-300">Personalizza questa scheda</h3>
      <p className="mt-0.5 text-xs text-zinc-500">
        Le modifiche vengono salvate su questo dispositivo e puoi ripristinare l'originale quando vuoi.
      </p>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-zinc-400">Descrizione</span>
        <textarea
          className="input min-h-32"
          value={curDesc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-zinc-400">Immagine (URL, oppure carica un file)</span>
        <input
          className="input"
          placeholder="https://... oppure lascia vuoto"
          value={curImage.startsWith('data:') ? '(immagine caricata dal dispositivo)' : curImage}
          onChange={(e) => setImageUrl(e.target.value)}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
          Carica immagine…
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
        {curImage && (
          <>
            <img src={curImage} alt="" className="h-12 w-12 rounded object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            <button onClick={() => setImageUrl('')} className="text-xs text-zinc-400 hover:text-red-300">Rimuovi immagine</button>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={save} className="rounded bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-500">Salva</button>
        <button onClick={() => { setOpen(false); setDesc(null); setImageUrl(null); }} className="rounded bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20">Annulla</button>
        {(override || entity.customized) && (
          <button onClick={restore} className="rounded bg-red-900/50 px-4 py-1.5 text-sm text-red-300 hover:bg-red-800/60">Ripristina originale</button>
        )}
      </div>
    </div>
  );
}
