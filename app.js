/* ============================================================
   CineAnime Gratis
   - Anime: Jikan API (https://jikan.moe) — gratuita, senza chiave
   - Film:  TMDB API (https://themoviedb.org) — chiave gratuita dell'utente
   Nessuno streaming pirata: per ogni titolo si rimanda a trailer
   ufficiali e a JustWatch per scoprire dove vederlo legalmente.
   ============================================================ */

const JIKAN = "https://api.jikan.moe/v4";
const TMDB = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="100%" height="100%" fill="#1c2330"/><text x="50%" y="50%" fill="#8b949e" font-size="20" text-anchor="middle" font-family="sans-serif">Nessuna immagine</text></svg>'
  );

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------------- Navigazione a tab ---------------- */
$$(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab").forEach((b) => b.classList.remove("active"));
    $$(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $("#" + btn.dataset.tab).classList.add("active");
  });
});

/* ---------------- Modale ---------------- */
const modal = $("#modal");
const modalBody = $("#modal-body");

function openModal(html) {
  modalBody.innerHTML = html;
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.classList.add("hidden");
  modalBody.innerHTML = "";
  document.body.style.overflow = "";
}
modal.querySelector(".modal-close").addEventListener("click", closeModal);
modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function justWatchUrl(title) {
  return "https://www.justwatch.com/it/cerca?q=" + encodeURIComponent(title);
}

function youtubeSearchUrl(title, extra) {
  return (
    "https://www.youtube.com/results?search_query=" +
    encodeURIComponent(title + " " + extra)
  );
}

/* ============================================================
   ANIME (Jikan)
   ============================================================ */
const animeGrid = $("#anime-grid");
let animeAbort = null;

const ANIME_LISTS = {
  top: `${JIKAN}/top/anime?limit=24`,
  airing: `${JIKAN}/top/anime?filter=airing&limit=24`,
  upcoming: `${JIKAN}/top/anime?filter=upcoming&limit=24`,
  movie: `${JIKAN}/top/anime?type=movie&limit=24`,
};

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Errore ${res.status}`);
  return res.json();
}

function renderAnimeCards(list) {
  if (!list.length) {
    animeGrid.innerHTML = '<p class="empty">Nessun risultato trovato.</p>';
    return;
  }
  animeGrid.innerHTML = "";
  const seen = new Set();
  list.forEach((a) => {
    if (seen.has(a.mal_id)) return;
    seen.add(a.mal_id);
    const card = document.createElement("div");
    card.className = "card";
    const img = a.images?.jpg?.image_url || PLACEHOLDER;
    const score = a.score ? `<span class="score">★ ${a.score}</span> · ` : "";
    card.innerHTML = `
      <img src="${esc(img)}" alt="${esc(a.title)}" loading="lazy" onerror="this.src='${PLACEHOLDER}'">
      <div class="card-info">
        <h3>${esc(a.title)}</h3>
        <p class="meta">${score}${esc(a.type || "")}${a.year ? " · " + a.year : ""}</p>
      </div>`;
    card.addEventListener("click", () => showAnimeDetail(a));
    animeGrid.appendChild(card);
  });
}

function showAnimeDetail(a) {
  const img = a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || PLACEHOLDER;
  const genres = (a.genres || []).map((g) => g.name).join(", ");
  const trailerId = a.trailer?.youtube_id;
  const synopsis = a.synopsis || "Trama non disponibile.";
  openModal(`
    <div class="detail">
      <img src="${esc(img)}" alt="${esc(a.title)}">
      <div class="detail-text">
        <h2>${esc(a.title)}</h2>
        <p class="meta">
          ${a.score ? `★ ${a.score} · ` : ""}${esc(a.type || "")}
          ${a.episodes ? ` · ${a.episodes} episodi` : ""}${a.year ? ` · ${a.year}` : ""}
          ${genres ? `<br>${esc(genres)}` : ""}
        </p>
        <p class="plot">${esc(synopsis)}</p>
        <div class="actions">
          <a class="action-link watch" href="${justWatchUrl(a.title)}" target="_blank" rel="noopener">📺 Dove vederlo legalmente</a>
          <a class="action-link info" href="https://www.crunchyroll.com/it/search?q=${encodeURIComponent(a.title)}" target="_blank" rel="noopener">🍥 Cerca su Crunchyroll</a>
          ${a.url ? `<a class="action-link info" href="${esc(a.url)}" target="_blank" rel="noopener">ℹ️ MyAnimeList</a>` : ""}
        </div>
        ${
          trailerId
            ? `<div class="trailer-embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(trailerId)}" title="Trailer" allowfullscreen></iframe></div>`
            : `<div class="actions" style="margin-top:12px"><a class="action-link trailer" href="${youtubeSearchUrl(a.title, "trailer")}" target="_blank" rel="noopener">▶ Cerca trailer su YouTube</a></div>`
        }
      </div>
    </div>`);
}

async function loadAnimeList(key) {
  animeGrid.innerHTML = '<p class="loading">Caricamento…</p>';
  if (animeAbort) animeAbort.abort();
  animeAbort = new AbortController();
  try {
    const data = await fetchJson(ANIME_LISTS[key], animeAbort.signal);
    renderAnimeCards(data.data || []);
  } catch (err) {
    if (err.name !== "AbortError")
      animeGrid.innerHTML = `<p class="empty">Errore nel caricamento (${esc(err.message)}). Riprova tra qualche secondo.</p>`;
  }
}

async function searchAnime(query) {
  animeGrid.innerHTML = '<p class="loading">Ricerca in corso…</p>';
  if (animeAbort) animeAbort.abort();
  animeAbort = new AbortController();
  try {
    const data = await fetchJson(
      `${JIKAN}/anime?q=${encodeURIComponent(query)}&limit=24&order_by=members&sort=desc`,
      animeAbort.signal
    );
    renderAnimeCards(data.data || []);
  } catch (err) {
    if (err.name !== "AbortError")
      animeGrid.innerHTML = `<p class="empty">Errore nella ricerca (${esc(err.message)}).</p>`;
  }
}

$("#anime-filters").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  $$("#anime-filters .chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  $("#anime-search").value = "";
  loadAnimeList(chip.dataset.list);
});

function doAnimeSearch() {
  const q = $("#anime-search").value.trim();
  if (q) searchAnime(q);
}
$("#anime-search-btn").addEventListener("click", doAnimeSearch);
$("#anime-search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doAnimeSearch();
});

/* ============================================================
   FILM (TMDB — chiave API gratuita fornita dall'utente)
   ============================================================ */
const filmGrid = $("#film-grid");
const setupBox = $("#tmdb-setup");
const filmContent = $("#film-content");
let filmAbort = null;

function tmdbKey() {
  return localStorage.getItem("tmdb_api_key") || "";
}

function refreshFilmUI() {
  const hasKey = !!tmdbKey();
  setupBox.classList.toggle("hidden", hasKey);
  filmContent.classList.toggle("hidden", !hasKey);
  if (hasKey) loadFilmList("popular");
}

$("#tmdb-key-save").addEventListener("click", async () => {
  const key = $("#tmdb-key-input").value.trim();
  if (!key) return;
  // Verifica la chiave con una chiamata di prova
  try {
    const res = await fetch(`${TMDB}/configuration?api_key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error();
    localStorage.setItem("tmdb_api_key", key);
    $("#tmdb-key-input").value = "";
    refreshFilmUI();
  } catch {
    alert("Chiave non valida: controlla di aver copiato la chiave API v3 completa.");
  }
});

$("#tmdb-key-reset").addEventListener("click", () => {
  localStorage.removeItem("tmdb_api_key");
  refreshFilmUI();
});

function renderFilmCards(list) {
  if (!list.length) {
    filmGrid.innerHTML = '<p class="empty">Nessun risultato trovato.</p>';
    return;
  }
  filmGrid.innerHTML = "";
  list.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card";
    const img = m.poster_path ? TMDB_IMG + m.poster_path : PLACEHOLDER;
    const year = (m.release_date || "").slice(0, 4);
    const score = m.vote_average ? `<span class="score">★ ${m.vote_average.toFixed(1)}</span>` : "";
    card.innerHTML = `
      <img src="${esc(img)}" alt="${esc(m.title)}" loading="lazy" onerror="this.src='${PLACEHOLDER}'">
      <div class="card-info">
        <h3>${esc(m.title)}</h3>
        <p class="meta">${score}${score && year ? " · " : ""}${year}</p>
      </div>`;
    card.addEventListener("click", () => showFilmDetail(m.id));
    filmGrid.appendChild(card);
  });
}

async function showFilmDetail(id) {
  try {
    const m = await fetchJson(
      `${TMDB}/movie/${id}?api_key=${encodeURIComponent(tmdbKey())}&language=it-IT&append_to_response=videos`
    );
    const img = m.poster_path ? TMDB_IMG + m.poster_path : PLACEHOLDER;
    const genres = (m.genres || []).map((g) => g.name).join(", ");
    const year = (m.release_date || "").slice(0, 4);
    const runtime = m.runtime ? `${m.runtime} min` : "";
    const trailer = (m.videos?.results || []).find(
      (v) => v.site === "YouTube" && v.type === "Trailer"
    ) || (m.videos?.results || []).find((v) => v.site === "YouTube");
    openModal(`
      <div class="detail">
        <img src="${esc(img)}" alt="${esc(m.title)}">
        <div class="detail-text">
          <h2>${esc(m.title)} ${year ? `(${year})` : ""}</h2>
          <p class="meta">
            ${m.vote_average ? `★ ${m.vote_average.toFixed(1)} · ` : ""}${runtime}
            ${genres ? `<br>${esc(genres)}` : ""}
          </p>
          <p class="plot">${esc(m.overview || "Trama non disponibile in italiano.")}</p>
          <div class="actions">
            <a class="action-link watch" href="${justWatchUrl(m.title)}" target="_blank" rel="noopener">📺 Dove vederlo legalmente</a>
            <a class="action-link info" href="https://www.themoviedb.org/movie/${m.id}" target="_blank" rel="noopener">ℹ️ Scheda TMDB</a>
          </div>
          ${
            trailer
              ? `<div class="trailer-embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(trailer.key)}" title="Trailer" allowfullscreen></iframe></div>`
              : `<div class="actions" style="margin-top:12px"><a class="action-link trailer" href="${youtubeSearchUrl(m.title, "trailer ita")}" target="_blank" rel="noopener">▶ Cerca trailer su YouTube</a></div>`
          }
        </div>
      </div>`);
  } catch (err) {
    openModal(`<p class="empty">Errore nel caricamento del dettaglio (${esc(err.message)}).</p>`);
  }
}

async function loadFilmList(key) {
  filmGrid.innerHTML = '<p class="loading">Caricamento…</p>';
  if (filmAbort) filmAbort.abort();
  filmAbort = new AbortController();
  try {
    const data = await fetchJson(
      `${TMDB}/movie/${key}?api_key=${encodeURIComponent(tmdbKey())}&language=it-IT&region=IT&page=1`,
      filmAbort.signal
    );
    renderFilmCards(data.results || []);
  } catch (err) {
    if (err.name !== "AbortError")
      filmGrid.innerHTML = `<p class="empty">Errore nel caricamento (${esc(err.message)}). Controlla la chiave API.</p>`;
  }
}

async function searchFilm(query) {
  filmGrid.innerHTML = '<p class="loading">Ricerca in corso…</p>';
  if (filmAbort) filmAbort.abort();
  filmAbort = new AbortController();
  try {
    const data = await fetchJson(
      `${TMDB}/search/movie?api_key=${encodeURIComponent(tmdbKey())}&language=it-IT&query=${encodeURIComponent(query)}`,
      filmAbort.signal
    );
    renderFilmCards(data.results || []);
  } catch (err) {
    if (err.name !== "AbortError")
      filmGrid.innerHTML = `<p class="empty">Errore nella ricerca (${esc(err.message)}).</p>`;
  }
}

$("#film-filters").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  $$("#film-filters .chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  $("#film-search").value = "";
  loadFilmList(chip.dataset.list);
});

function doFilmSearch() {
  const q = $("#film-search").value.trim();
  if (q) searchFilm(q);
}
$("#film-search-btn").addEventListener("click", doFilmSearch);
$("#film-search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doFilmSearch();
});

/* ---------------- Avvio ---------------- */
loadAnimeList("top");
refreshFilmUI();
