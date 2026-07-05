// Official SRD artwork from the 5e-bits/5e-database project (MIT license),
// downscaled to 512px WebP and bundled with the app so images load instantly
// and work fully offline instead of hotlinking dnd5eapi.co (which is slow or
// unreachable on many devices, and 404s on some variant items).

const files = import.meta.glob('../assets/srd-art/*.webp', { eager: true, query: '?url', import: 'default' });

// Turns the stored remote URL into a bundled asset URL. Variant entries whose
// remote file is broken upstream (e.g. dragon-scale-mail-black) fall back to
// the parent artwork by progressively stripping trailing suffixes.
export function bundledArtFor(remoteUrl) {
  if (!remoteUrl) return null;
  let m;
  try {
    const path = new URL(remoteUrl).pathname;
    m = /\/api(?:\/\d+)?\/images\/([^/]+)\/([^/]+)\.png$/.exec(path) || /\/api\/\d+\/([^/]+)\/([^/]+)\.png$/.exec(path);
  } catch {
    return null;
  }
  if (!m) return null;
  let key = `${m[1]}-${m[2]}`;
  while (true) {
    const hit = files[`../assets/srd-art/${key}.webp`];
    if (hit) return hit;
    const idx = key.lastIndexOf('-');
    if (idx <= m[1].length) return null;
    key = key.slice(0, idx);
  }
}
