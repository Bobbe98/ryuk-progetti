const STORAGE_KEY = 'dnd5e-server-url';

// In dev (browser, Vite) a relative path works thanks to the Vite proxy.
// In the packaged Android app there is no proxy, so a full URL must be
// configured by the user via the Impostazioni page before first use.
const DEFAULT_URL = '';

export function getServerUrl() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
}

export function setServerUrl(url) {
  const trimmed = url.trim().replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY, trimmed);
}

export function getApiBase() {
  return `${getServerUrl()}/api`;
}
