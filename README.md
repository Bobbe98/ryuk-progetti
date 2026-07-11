# 🎬 CineAnime Gratis

Un'app web per **scoprire film e anime** e trovare **dove guardarli gratis in modo legale** (piattaforme con pubblicità come RaiPlay, Pluto TV, Crunchyroll free, Mediaset Infinity, Plex, Rakuten TV Free…).

> ⚠️ L'app **non trasmette contenuti pirata**: cataloga i titoli, mostra i trailer ufficiali e ti indirizza alle piattaforme legali dove sono disponibili.

## Funzionalità

- **Anime** — top di sempre, in corso, in arrivo, film anime; ricerca; scheda con trama, trailer YouTube integrato e link a Crunchyroll/JustWatch. Dati da [Jikan API](https://jikan.moe) (MyAnimeList), gratuita e senza chiave.
- **Film** — popolari, al cinema ora, più votati, in arrivo; ricerca; scheda in italiano con trailer e link "dove vederlo legalmente" (JustWatch). Dati da [TMDB](https://www.themoviedb.org).
- **Dove guardare gratis** — elenco di piattaforme legali gratuite disponibili in Italia.

## Come si usa

Non serve installare nulla: è HTML/CSS/JS puro.

1. Apri `index.html` nel browser (oppure servi la cartella: `python3 -m http.server 8000` e vai su http://localhost:8000).
2. La sezione **Anime** funziona subito.
3. Per la sezione **Film** serve una chiave API TMDB gratuita:
   - registrati su [themoviedb.org](https://www.themoviedb.org/signup)
   - richiedi la chiave in [Impostazioni → API](https://www.themoviedb.org/settings/api)
   - incollala nell'app (viene salvata solo nel tuo browser).

## Struttura

```
index.html   – markup e sezioni (Anime, Film, Piattaforme)
style.css    – tema scuro, griglie responsive, modale
app.js       – chiamate API Jikan/TMDB, ricerca, dettagli, trailer
```

## Note legali

Questo prodotto usa le API TMDB e Jikan ma non è approvato o certificato da TMDB o MyAnimeList. Tutti i link di visione puntano esclusivamente a piattaforme legali.
