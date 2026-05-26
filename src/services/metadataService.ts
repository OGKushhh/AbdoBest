import axios from 'axios';
import {API_BASE, METADATA_ENDPOINTS} from '../constants/endpoints';
import {
  setMetadataWithTimestamp, getMetadataIfFresh, getMetadataAnyAge,
  getCategoryTimestamp, isAnyCategoryStale, clearAllMetadataCache,
} from '../storage/cache';
import {ContentItem, TrendingContent} from '../types';
import {METADATA_TTL_MS} from '../constants/endpoints';

const metadataApi = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export type ContentCategory =
  | 'movies' | 'dubbed-movies' | 'hindi' | 'asian-movies'
  | 'anime'  | 'anime-movies'  | 'series' | 'tvshows'
  | 'asian-series' | 'arabic-series' | 'trending' | 'featured';

type ContentDict = Record<string, ContentItem>;

export type BackgroundUpdateCallback = (
  category: ContentCategory,
  data: ContentDict | TrendingContent,
) => void;

// ─────────────────────────────────────────────────────────────────────────────
// _runtimeCache — module-level in-memory store
//
// After any category loads (from disk or network), the parsed + sorted array
// is stashed here. CategoryScreen checks this first — if populated by
// HomeScreen on launch, it gets the data instantly with zero disk reads,
// zero JSON.parse, and zero sort. Survives navigation, cleared on force refresh.
// ─────────────────────────────────────────────────────────────────────────────
const _runtimeCache = new Map<string, ContentItem[]>();

// ─── Shared sort helper — used at store time so data is always pre-sorted ────
// Exported so HomeScreen and CategoryScreen can import instead of duplicating.
const _parseYear = (val: any): number => {
  if (!val) return 0;
  const n = parseInt(String(val).slice(0, 4), 10);
  return isNaN(n) ? 0 : n;
};

export const sortByNewest = (items: ContentItem[]): ContentItem[] =>
  [...items].sort((a, b) => {
    const ya = _parseYear((a as any).ReleaseDate || (a as any).Year);
    const yb = _parseYear((b as any).ReleaseDate || (b as any).Year);
    if (ya !== yb) return yb - ya;
    const sa = (a as any).last_scraped || '';
    const sb = (b as any).last_scraped || '';
    return sb.localeCompare(sa);
  });

/** Read from runtime cache. Returns null if not yet populated. */
export const getRuntimeCache = (category: string): ContentItem[] | null =>
  _runtimeCache.get(category) ?? null;

/** Populate runtime cache.
 *  - Pass a pre-sorted array (from disk) → stored as-is, no re-sort.
 *  - Pass an unsorted array (raw dict values) → sorted here.
 *  The `alreadySorted` flag is set internally when we know the data came
 *  from a disk file that was written pre-sorted by fetchAndCache.
 */
const _setRuntimeCache = (category: string, items: ContentItem[], alreadySorted = false): void => {
  _runtimeCache.set(category, alreadySorted ? items : sortByNewest(items));
};

/** Invalidate one or all entries — called on force refresh. */
export const clearRuntimeCache = (category?: string): void => {
  if (category) _runtimeCache.delete(category);
  else _runtimeCache.clear();
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal: fetch from API, normalise, and write to cache
// ─────────────────────────────────────────────────────────────────────────────
const fetchAndCache = async (
  category: ContentCategory,
): Promise<ContentDict | TrendingContent | null> => {
  const endpoint = METADATA_ENDPOINTS[category];
  if (!endpoint) {
    console.warn(`[Metadata] Unknown category: ${category}`);
    return null;
  }

  const response = await metadataApi.get(endpoint);
  let data = response.data;

  // Normalise arabic-series fields → standard ContentItem fields
  if (
    category !== 'trending' &&
    category !== 'featured' &&
    data &&
    typeof data === 'object' &&
    !Array.isArray(data)
  ) {
    Object.keys(data).forEach(id => {
      if (!data[id]) return;
      data[id].id = id;

      if (category === 'arabic-series' || data[id].is_ramadan !== undefined) {
        const item = data[id];
        if (item.year && !item.Year) {
          const n = parseInt(item.year, 10);
          if (!isNaN(n) && n >= 2000 && n <= 2030) item.Year = String(n);
        }
        if (item.is_ramadan !== undefined) item.IsRamadan = !!item.is_ramadan;
        if (item.title    && !item.Title)       item.Title       = item.title;
        if (item.genres_en && !item.Genres)     item.Genres      = item.genres_en;
        if (item.genres_ar && !item.GenresAr)   item.GenresAr    = item.genres_ar;
        if (item.poster   && !item.Image)       item.Image       = item.poster;
        if (item.poster   && !item['Image Source']) item['Image Source'] = item.poster;
        if (item.rating !== undefined && !item.Rating) item.Rating = String(item.rating);
        if (item.quality  && !item.Format)      item.Format      = item.quality;
        if (item.country  && !item.Country)     item.Country     = item.country;
        if (item.episode_count !== undefined)   item.NumberOfEpisodes = item.episode_count;
        if (!item.Category) item.Category = 'arabic-series';
      }
    });
  }

  // Sort once here, write the sorted array to disk.
  // All subsequent cold-start reads get a pre-sorted array — zero sort cost.
  const sorted = sortByNewest(Object.values(data) as ContentItem[]);
  await setMetadataWithTimestamp(category, sorted);
  _setRuntimeCache(category, sorted, true); // already sorted
  console.log(`[Metadata] Fetched & cached: ${category}`);
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// loadCategory — stale-while-revalidate
//
// Behaviour:
//   • Cache fresh (< 24 h)   → return cache immediately, no network call.
//   • Cache stale (≥ 24 h)   → return cache immediately for instant display,
//                               kick off a background fetch, call
//                               onBackgroundUpdate(category, freshData) when done.
//   • No cache at all        → must wait for the network (first install / cleared).
//   • forceRefresh = true    → always wait for a fresh network response
//                               (pull-to-refresh path).
// ─────────────────────────────────────────────────────────────────────────────
export const loadCategory = async (
  category: ContentCategory,
  forceRefresh = false,
  onBackgroundUpdate?: BackgroundUpdateCallback,
): Promise<ContentDict | TrendingContent | null> => {

  // ── Force refresh: skip cache entirely, also clear runtime cache ───────────
  if (forceRefresh) {
    _runtimeCache.delete(category);
    try {
      const fresh = await fetchAndCache(category);
      // fetchAndCache already populated _runtimeCache — nothing to do here.
      return fresh;
    } catch (error: any) {
      console.warn(`[Metadata] Force-fetch failed for ${category}: ${error.message}`);
      const fallback = await getMetadataAnyAge(category);
      if (fallback) _setRuntimeCache(category, toItemsArray(fallback), Array.isArray(fallback));
      return fallback;
    }
  }

  // ── Check freshness ─────────────────────────────────────────────────────
  const ts      = getCategoryTimestamp(category);
  const ageMs   = ts ? Date.now() - ts : Infinity;
  const isStale = ageMs >= METADATA_TTL_MS;

  // ── Fresh cache: return immediately, no network ─────────────────────────
  if (!isStale) {
    const fresh = await getMetadataIfFresh(category);
    if (fresh !== null) {
      _setRuntimeCache(category, toItemsArray(fresh), Array.isArray(fresh));
      return fresh;
    }
  }

  // ── Stale or missing cache ──────────────────────────────────────────────
  const cached = await getMetadataAnyAge(category);

  if (cached !== null && onBackgroundUpdate) {
    _setRuntimeCache(category, toItemsArray(cached), Array.isArray(cached));
    fetchAndCache(category)
      .then(fresh => {
        if (fresh) {
          // fetchAndCache already updated _runtimeCache
          onBackgroundUpdate(category, fresh);
        }
      })
      .catch(err => {
        console.warn(`[Metadata] Background fetch failed for ${category}: ${err.message}`);
      });
    return cached;
  }

  if (cached !== null && !onBackgroundUpdate) {
    _setRuntimeCache(category, toItemsArray(cached), Array.isArray(cached));
    fetchAndCache(category)
      .then(() => {}) // fetchAndCache updates _runtimeCache internally
      .catch(() => {});
    return cached;
  }

  // ── No cache at all: must wait ───────────────────────────────────────────
  try {
    return await fetchAndCache(category);
  } catch (error: any) {
    console.warn(`[Metadata] Fetch failed for ${category}: ${error.message}`);
    throw new Error(`Failed to load ${category}. Check your internet connection.`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Convenience wrappers (unchanged API)
// ─────────────────────────────────────────────────────────────────────────────

export const loadMovies = async (forceRefresh = false): Promise<ContentDict> => {
  const data = await loadCategory('movies', forceRefresh);
  return (data as ContentDict) || {};
};

export const loadTrending = async (forceRefresh = false): Promise<TrendingContent | null> => {
  const data = await loadCategory('trending', forceRefresh);
  return data as TrendingContent | null;
};

export const loadFeatured = async (forceRefresh = false): Promise<TrendingContent | null> => {
  const data = await loadCategory('featured', forceRefresh);
  return data as TrendingContent | null;
};

export const loadSeries = async (forceRefresh = false): Promise<ContentDict> => {
  const data = await loadCategory('series', forceRefresh);
  return (data as ContentDict) || {};
};

export const loadAnime = async (forceRefresh = false): Promise<ContentDict> => {
  const data = await loadCategory('anime', forceRefresh);
  return (data as ContentDict) || {};
};

export const loadTVShows = async (forceRefresh = false): Promise<ContentDict> => {
  const data = await loadCategory('tvshows', forceRefresh);
  return (data as ContentDict) || {};
};

// ─────────────────────────────────────────────────────────────────────────────
// Search & Filter utilities (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const searchContent = async (query: string): Promise<ContentItem[]> => {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];

  const availableCategories: ContentCategory[] = [
    'movies', 'series', 'anime', 'tvshows', 'asian-series', 'arabic-series',
    'dubbed-movies', 'hindi', 'asian-movies',
  ];

  const matches: ContentItem[] = [];
  const seen = new Set<string>();

  const testItem = (item: ContentItem): boolean =>
    !!(item.Title?.toLowerCase().includes(lowerQuery) ||
    item.Genres?.some(g => g.toLowerCase().includes(lowerQuery)) ||
    item.GenresAr?.some(g => g.toLowerCase().includes(lowerQuery)) ||
    item.Country?.toLowerCase().includes(lowerQuery));

  for (const cat of availableCategories) {
    // ── Runtime cache hit: search in memory, zero disk IO ──────────────────
    const cached = _runtimeCache.get(cat);
    if (cached) {
      for (const item of cached) {
        if (matches.length >= 60) break;
        if (!seen.has(item.id) && testItem(item)) {
          seen.add(item.id);
          matches.push(item);
        }
      }
      if (matches.length >= 60) break;
      continue;
    }

    // ── Cache miss: fall back to disk (first launch before HomeScreen loads) ─
    let data = await getMetadataAnyAge(cat);
    if (!data || typeof data !== 'object' || (Array.isArray(data) ? data.length === 0 : Object.keys(data).length === 0)) {
      try { data = await loadCategory(cat, false); } catch { continue; }
    }
    if (!data || typeof data !== 'object') continue;

    const items = toItemsArray(data) as ContentItem[];
    for (const item of items) {
      if (matches.length >= 60) break;
      if (!seen.has(item.id) && testItem(item)) {
        seen.add(item.id);
        matches.push(item);
      }
    }
    if (matches.length >= 60) break;
  }

  return matches;
};

export const searchContentInDict = (movies: ContentDict, query: string): ContentItem[] => {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];

  return Object.values(movies).filter(item => {
    const titleMatch   = item.Title?.toLowerCase().includes(lowerQuery);
    const genreMatch   = item.Genres?.some(g => g.toLowerCase().includes(lowerQuery));
    const genreArMatch = item.GenresAr?.some(g => g.toLowerCase().includes(lowerQuery));
    const countryMatch = item.Country?.toLowerCase().includes(lowerQuery);
    const formatMatch  = item.Format?.toLowerCase().includes(lowerQuery);
    return titleMatch || genreMatch || genreArMatch || countryMatch || formatMatch;
  });
};

export const filterByGenre = (movies: ContentDict, genre: string): ContentItem[] => {
  const cleanGenre = genre.replace(/^[\p{Emoji}\s]+/u, '').trim();
  return Object.values(movies).filter(item =>
    item.Genres?.some(g => g.toLowerCase().includes(cleanGenre.toLowerCase())) ||
    item.GenresAr?.includes(genre),
  );
};

export const getMoviesArray = (movies: ContentDict | null): ContentItem[] => {
  if (!movies || typeof movies !== 'object') return [];
  return Object.values(movies);
};

/**
 * Migration guard: disk files written before this change are dicts,
 * new ones are sorted arrays. Handle both transparently.
 */
const toItemsArray = (data: any): ContentItem[] => {
  if (!data || typeof data !== 'object') return [];
  return Array.isArray(data) ? data : Object.values(data);
};

// ─────────────────────────────────────────────────────────────────────────────
// Sync utilities (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const SYNC_CATEGORIES: ContentCategory[] = [
  'movies', 'series', 'anime', 'tvshows', 'asian-series', 'arabic-series',
  'dubbed-movies', 'hindi', 'asian-movies', 'anime-movies',
  'trending', 'featured',
];

export interface SyncProgress {
  category: string;
  done: number;
  total: number;
  percent: number;
  fromCache: boolean;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

export const syncAllWithProgress = async (
  onProgress?: SyncProgressCallback,
  forceRefresh = false,
): Promise<void> => {
  const total = SYNC_CATEGORIES.length;
  for (let i = 0; i < SYNC_CATEGORIES.length; i++) {
    const cat = SYNC_CATEGORIES[i];
    const isStale =
      forceRefresh ||
      getCategoryTimestamp(cat) === 0 ||
      Date.now() - getCategoryTimestamp(cat) > METADATA_TTL_MS;

    try {
      // Always load every category: stale ones fetch network,
      // fresh ones read disk. Both populate _runtimeCache so
      // screens read from memory with zero disk IO afterward.
      await loadCategory(cat, isStale);
    } catch {
      // continue even if one fails
    }
    // Report progress AFTER load completes so bar reflects actual work done,
    // not work about to start (was one step behind before).
    onProgress?.({
      category: cat,
      done: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 100),
      fromCache: !isStale,
    });
    // Yield between categories so the JS thread can process UI events
    // (progress bar updates, touch events) between each heavy parse+sort.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  onProgress?.({category: 'done', done: total, total, percent: 100, fromCache: false});
};

export const refreshStaleCategories = async (
  onProgress?: SyncProgressCallback,
): Promise<void> => {
  await syncAllWithProgress(onProgress, false);
};

export const syncIfNeeded = async (
  onProgress?: SyncProgressCallback,
): Promise<boolean> => {
  if (!isAnyCategoryStale()) return false;
  try {
    await syncAllWithProgress(onProgress, false);
    return true;
  } catch {
    return false;
  }
};

export const getLastSyncTime = (): number => {
  let latest = 0;
  const categories: ContentCategory[] = [
    'movies', 'anime', 'series', 'tvshows', 'asian-series', 'trending', 'featured',
  ];
  for (const cat of categories) {
    const ts = getCategoryTimestamp(cat);
    if (ts > latest) latest = ts;
  }
  return latest;
};
