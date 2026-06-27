import { Capacitor } from '@capacitor/core';
import { getApiBase } from './serverConfig';
import { localApi } from './local/localApi';

const isNative = Capacitor.isNativePlatform();

async function request(path, options = {}) {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Errore ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

const networkApi = {
  meta: () => request('/meta'),

  creatures: (params) => request(`/creatures?${new URLSearchParams(params)}`),
  creature: (id) => request(`/creatures/${id}`),
  createCreature: (data) => request('/creatures', { method: 'POST', body: JSON.stringify(data) }),
  updateCreature: (id, data) => request(`/creatures/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCreature: (id) => request(`/creatures/${id}`, { method: 'DELETE' }),

  items: (params) => request(`/items?${new URLSearchParams(params)}`),
  item: (id) => request(`/items/${id}`),
  createItem: (data) => request('/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id, data) => request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),

  generateEncounter: (data) => request('/encounters/generate', { method: 'POST', body: JSON.stringify(data) }),
  generateShop: (data) => request('/shops/generate', { method: 'POST', body: JSON.stringify(data) }),
};

// On native Android/iOS builds the app runs fully offline against embedded
// SRD data + on-device homebrew storage; in the browser (dev or self-hosted
// web deploy) it talks to the configurable server as before.
export const api = isNative ? localApi : networkApi;
