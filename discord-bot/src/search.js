import { config } from './config.js';

const UA = { 'User-Agent': 'AiutanteDiscordBot/1.0 (https://github.com/Bobbe98/ryuk-progetti)' };

async function getJSON(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** Cerca su Wikipedia e restituisce fino a `limit` risultati con riassunto. */
export async function wikipedia(query, limit = 3, lang = config.wikiLang) {
  const base = `https://${lang}.wikipedia.org`;
  const s = await getJSON(`${base}/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`);
  const hits = s.query?.search ?? [];
  const out = await Promise.all(
    hits.map(async (h) => {
      try {
        const p = await getJSON(`${base}/api/rest_v1/page/summary/${encodeURIComponent(h.title.replace(/ /g, '_'))}`);
        return { source: 'Wikipedia', title: p.title, text: p.extract, url: p.content_urls?.desktop?.page, image: p.thumbnail?.source };
      } catch {
        return { source: 'Wikipedia', title: h.title, text: h.snippet.replace(/<[^>]+>/g, ''), url: `${base}/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}` };
      }
    }),
  );
  return out.filter((r) => r.text);
}

/** DuckDuckGo Instant Answer (gratuita, senza chiave). */
export async function duckduckgo(query) {
  const d = await getJSON(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&kl=it-it`);
  const out = [];
  if (d.AbstractText) out.push({ source: d.AbstractSource || 'DuckDuckGo', title: d.Heading || query, text: d.AbstractText, url: d.AbstractURL, image: d.Image ? new URL(d.Image, 'https://duckduckgo.com').href : undefined });
  if (d.Answer) out.push({ source: 'DuckDuckGo', title: 'Risposta rapida', text: String(d.Answer), url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}` });
  for (const t of (d.RelatedTopics ?? []).flatMap((x) => x.Topics ?? [x]).slice(0, 3)) {
    if (t.Text && t.FirstURL) out.push({ source: 'DuckDuckGo', title: t.Text.split(' - ')[0].slice(0, 100), text: t.Text, url: t.FirstURL });
  }
  return out;
}

/** Ricerca combinata: in parallelo su più fonti, gli errori di una fonte non bloccano le altre. */
export async function searchAll(query) {
  const [wiki, ddg] = await Promise.allSettled([wikipedia(query), duckduckgo(query)]);
  const results = [...(ddg.value ?? []), ...(wiki.value ?? [])];
  const seen = new Set();
  return results.filter((r) => (r.url && !seen.has(r.url) ? seen.add(r.url) : false));
}
