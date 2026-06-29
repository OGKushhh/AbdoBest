/**
 * favoritesService.ts
 * Manages the 3 user collections: favourites, watched, watch_later.
 *
 * Architecture:
 *   - Source of truth is the Flask backend (/data/users/{uid}.json on HF Spaces)
 *   - A local AsyncStorage cache mirrors the server state so the UI is instant
 *   - Every add/remove writes locally first, then syncs to server in background
 *   - On app start, a full fetch from server overwrites the local cache
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIdToken } from './authService';
import { API_BASE } from '../constants/endpoints';

// ─── Types ──────────────────────────────────────────────────────────────────
export type CollectionName = 'favourites' | 'watched' | 'watch_later';

export interface WatchedProgress {
  season?: number;   // null for movies
  episode?: number;
}

export interface CollectionEntry {
  title:      string;
  image:      string;
  category:   string;
  content_id: string;
  added_at:   string;
  progress?:  WatchedProgress;  // watched only
}

export type Collection = Record<string, CollectionEntry>;  // key = "category:content_id"

export interface AllCollections {
  favourites:  Collection;
  watched:     Collection;
  watch_later: Collection;
}

// ─── Storage key ────────────────────────────────────────────────────────────
const COLLECTIONS_KEY = 'user_collections';

// ─── Series-type categories (the ones that can have new episodes) ────────────
export const NOTIFIABLE_CATEGORIES = new Set([
  'series', 'tvshows', 'asian-series', 'arabic-series', 'anime',
]);

// ─── Local cache helpers ─────────────────────────────────────────────────────
async function readLocalCollections(): Promise<AllCollections> {
  try {
    const raw = await AsyncStorage.getItem(COLLECTIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { favourites: {}, watched: {}, watch_later: {} };
}

async function writeLocalCollections(cols: AllCollections): Promise<void> {
  try {
    await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols));
  } catch { /* ignore */ }
}

// ─── Fetch all collections from server ──────────────────────────────────────
export async function fetchCollections(): Promise<AllCollections> {
  const token = await getIdToken();
  if (!token) return readLocalCollections();

  try {
    const res = await fetch(`${API_BASE}/api/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cols: AllCollections = {
      favourites:  data.collections?.favourites  ?? {},
      watched:     data.collections?.watched     ?? {},
      watch_later: data.collections?.watch_later ?? {},
    };
    await writeLocalCollections(cols);
    return cols;
  } catch (e) {
    console.warn('[Favorites] Fetch failed, using local cache:', e);
    return readLocalCollections();
  }
}

// ─── Add to collection ───────────────────────────────────────────────────────
export async function addToCollection(
  collection: CollectionName,
  item: {
    content_id: string;
    category:   string;
    title:      string;
    image:      string;
    progress?:  WatchedProgress;
  },
): Promise<void> {
  const key = `${item.category}:${item.content_id}`;
  const entry: CollectionEntry = {
    title:      item.title,
    image:      item.image,
    category:   item.category,
    content_id: item.content_id,
    added_at:   new Date().toISOString(),
    ...(item.progress ? { progress: item.progress } : {}),
  };

  // Write locally first — UI is instant
  const cols = await readLocalCollections();
  cols[collection][key] = entry;
  await writeLocalCollections(cols);

  // Sync to server in background
  const token = await getIdToken();
  if (!token) return;
  fetch(`${API_BASE}/api/favorites`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_token:   token,
      action:     'add',
      collection,
      content_id: item.content_id,
      category:   item.category,
      title:      item.title,
      image:      item.image,
      ...(item.progress ? { progress: item.progress } : {}),
    }),
  }).catch(e => console.warn('[Favorites] Add sync failed:', e));
}

// ─── Remove from collection ──────────────────────────────────────────────────
export async function removeFromCollection(
  collection: CollectionName,
  content_id: string,
  category:   string,
): Promise<void> {
  const key = `${category}:${content_id}`;

  // Write locally first
  const cols = await readLocalCollections();
  delete cols[collection][key];
  await writeLocalCollections(cols);

  // Sync to server in background
  const token = await getIdToken();
  if (!token) return;
  fetch(`${API_BASE}/api/favorites`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_token:   token,
      action:     'remove',
      collection,
      content_id,
      category,
    }),
  }).catch(e => console.warn('[Favorites] Remove sync failed:', e));
}

// ─── Toggle helpers (used by the heart button) ───────────────────────────────
export async function toggleFavourite(
  item: { content_id: string; category: string; title: string; image: string },
): Promise<boolean> {
  const cols = await readLocalCollections();
  const key  = `${item.category}:${item.content_id}`;
  const isIn = key in cols.favourites;
  if (isIn) {
    await removeFromCollection('favourites', item.content_id, item.category);
  } else {
    await addToCollection('favourites', item);
  }
  return !isIn;  // returns new state: true = now in favourites
}

// ─── Query helpers ───────────────────────────────────────────────────────────
export async function isInCollection(
  collection: CollectionName,
  content_id: string,
  category:   string,
): Promise<boolean> {
  const cols = await readLocalCollections();
  return `${category}:${content_id}` in cols[collection];
}

export async function getCollectionItems(
  collection: CollectionName,
): Promise<CollectionEntry[]> {
  const cols = await readLocalCollections();
  return Object.values(cols[collection]).sort(
    (a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime(),
  );
}

// ─── Update watch progress ───────────────────────────────────────────────────
export async function updateWatchProgress(
  content_id: string,
  category:   string,
  title:      string,
  image:      string,
  progress:   WatchedProgress,
): Promise<void> {
  await addToCollection('watched', { content_id, category, title, image, progress });
}

// ─── Clear local cache (on sign-out) ─────────────────────────────────────────
export async function clearCollectionsCache(): Promise<void> {
  await AsyncStorage.removeItem(COLLECTIONS_KEY);
}
