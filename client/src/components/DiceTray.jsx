import { useEffect, useRef, useState } from 'react';
import { onRoll, rollAndBroadcast, parseDice } from '../lib/dice';

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100];

// Floating global dice tray: quick dice, custom formulas, roll history.
// Also receives every roll made by tapping a formula chip anywhere in the app.
export default function DiceTray() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [custom, setCustom] = useState('');
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(null);

  useEffect(() => {
    return onRoll((result) => {
      setHistory((h) => [{ ...result, at: Date.now() }, ...h].slice(0, 30));
      setFlash(result);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 2600);
    });
  }, []);

  function rollCustom(e) {
    e.preventDefault();
    if (parseDice(custom)) {
      rollAndBroadcast(custom);
      setCustom('');
    }
  }

  return (
    <>
      {/* Result toast, visible even with the tray closed */}
      {flash && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 animate-dice-pop rounded-xl border border-amber-500/40 bg-[#1f1a10]/95 px-4 py-2 text-left shadow-lg shadow-black/50 backdrop-blur"
        >
          <span className="block text-xs text-amber-400/80">{flash.formula}</span>
          <span className="block text-2xl font-bold text-amber-300">{flash.total}</span>
          <span className="block text-[10px] text-zinc-400">[{flash.rolls.join(', ')}]{flash.modifier ? ` ${flash.modifier > 0 ? '+' : ''}${flash.modifier}` : ''}</span>
        </button>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Tiradadi"
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/40 bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg shadow-black/50 transition hover:scale-105 active:scale-95"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="h-7 w-7">
          <path d="M12 2l8.5 6v8L12 22l-8.5-6V8L12 2Z" />
          <path d="M12 2v7.5M3.5 8l8.5 1.5L20.5 8M12 22v-6M12 16l-8.5-6M12 16l8.5-6" opacity="0.6" />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-amber-500/30 bg-[#181420]/97 shadow-2xl shadow-black/60 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <h3 className="font-display text-sm font-semibold tracking-wide text-amber-300">Tiradadi</h3>
            <button onClick={() => setOpen(false)} className="rounded px-2 text-zinc-400 hover:bg-white/10 hover:text-white">✕</button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 px-4 pt-3">
            {QUICK_DICE.map((f) => (
              <button
                key={f}
                onClick={() => rollAndBroadcast(`1d${f}`)}
                className="rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300"
              >
                d{f}
              </button>
            ))}
          </div>

          <form onSubmit={rollCustom} className="flex gap-2 px-4 pt-3">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Es. 3d6+2"
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={!parseDice(custom)}
              className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-30"
            >
              Tira
            </button>
          </form>

          <div className="mt-3 max-h-56 overflow-y-auto border-t border-white/10 px-4 py-2">
            {history.length === 0 && <p className="py-3 text-center text-xs text-zinc-500">Nessun tiro ancora. Tocca un dado o una formula come 2d6+3 in una scheda.</p>}
            {history.map((h) => (
              <div key={h.at + h.formula + h.total} className="flex items-baseline justify-between gap-2 border-b border-white/5 py-1.5 last:border-0">
                <span className="text-xs text-zinc-400">{h.formula}</span>
                <span className="text-[10px] text-zinc-500">[{h.rolls.join(', ')}]{h.modifier ? ` ${h.modifier > 0 ? '+' : ''}${h.modifier}` : ''}</span>
                <span className="min-w-8 text-right text-sm font-bold text-amber-300">{h.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
