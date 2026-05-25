/**
 * API service for AbdoBest
 *
 * /extract endpoint:
 *   POST { url: pageUrl }
 *   Response: { stream_url, quality_options, cached }
 *
 * /api/view/:category/:id:
 *   GET  → { views }
 *   POST { increment_by } → { views }
 */

import axios from 'axios';
import {API_BASE} from '../constants/endpoints';
import {getVideoUrlCache, setVideoUrlCache} from '../storage/cache';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2min — Playwright extraction + HF Spaces cold start
});

export interface ExtractResult {
  video_url: string;       // normalised from stream_url
  quality_options: string[];
  cached: boolean;
}

/**
 * Extract a playable stream URL for a given page URL.
 *
 * Cache layer (6 h):
 *  1. Local MMKV cache → instant, no network
 *  2. Backend /extract → may trigger Playwright scraping (slow first run)
 *     Backend itself also caches and returns `cached: true` on hits.
 */
export const extractVideoUrl = async (pageUrl: string): Promise<ExtractResult> => {
  if (!pageUrl || !pageUrl.startsWith('http')) {
    throw new Error('Invalid or missing source URL for extraction');
  }

  // 1. Local 6-hour cache
  const localHit = getVideoUrlCache(pageUrl);
  if (localHit) {
    console.log('[API] Local cache hit');
    return {video_url: localHit.url, quality_options: localHit.qualities, cached: true};
  }

  // 2. Call backend /extract
  console.log('[API] Calling /extract for:', pageUrl.substring(0, 80));
  const response = await api.post('/extract', {url: pageUrl});
  const data = response.data;

  const streamUrl: string = data.stream_url || data.video_url || '';
  if (!streamUrl) {
    throw new Error(data.error || 'Server returned no stream URL');
  }

  // Use quality_options from server if provided, else derive from URL
  const qualities: string[] =
    data.quality_options?.length
      ? data.quality_options
      : streamUrl.toLowerCase().includes('master')
      ? ['Auto', '1080p', '720p', '480p', '360p']
      : ['Auto'];

  // 3. Store locally
  setVideoUrlCache(pageUrl, streamUrl, qualities);

  return {video_url: streamUrl, quality_options: qualities, cached: data.cached ?? false};
};

export const refreshVideoUrl = async (pageUrl: string): Promise<ExtractResult> => {
  // Delete local cache entry so we force a fresh /extract call
  // (we can't call storage.delete here directly but we can pass a busted key)
  const bustUrl = `${pageUrl}${pageUrl.includes('?') ? '&' : '?'}_nc=${Date.now()}`;
  return extractVideoUrl(bustUrl);
};

export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const r = await api.get('/health', {timeout: 10000});
    return r.data?.status === 'healthy';
  } catch {
    return false;
  }
};

import { encode as b64encode } from 'base-64';

// ─── View counter endpoints ─────────────────────────────────────────

/**
 * Encode a content ID for safe use in URL paths.
 * Uses base-64 package (not btoa) because Hermes's btoa only handles Latin1
 * and will silently corrupt or throw on percent-encoded Unicode strings.
 */
const encodeContentId = (id: string): string => {
  if (id.startsWith('http://') || id.startsWith('https://')) {
    return b64encode(encodeURIComponent(id))
      .replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
  }
  return encodeURIComponent(id);
};

export const postViewCount = async (
  category: string,
  contentId: string,
  incrementBy = 1,
): Promise<number> => {
  const safeId = encodeContentId(contentId);
  const r = await api.post(`/api/view/${category}/${safeId}`, {increment_by: incrementBy});
  return r.data?.views ?? 0;
};

/** Record a series-level view AND a per-episode view in one call (season-aware) */
export const postEpisodeView = async (
  category: string,
  seriesId: string,
  epNumber: number,
  seasonNumber: number = 1,
): Promise<void> => {
  await api.post(`/api/view/${category}/${seriesId}/season/${seasonNumber}/episode/${epNumber}`, {});
};

export const getViewCount = async (
  category: string,
  contentId: string,
): Promise<number> => {
  const safeId = encodeContentId(contentId);
  const r = await api.get(`/api/view/${category}/${safeId}`);
  return r.data?.views ?? 0;
};

/** Get per-episode view count (season-aware) */
export const getEpisodeViewCount = async (
  category: string,
  seriesId: string,
  epNumber: number,
  seasonNumber: number = 1,
): Promise<number> => {
  const r = await api.get(`/api/view/${category}/${seriesId}/season/${seasonNumber}/episode/${epNumber}`);
  return r.data?.views ?? 0;
};

/**
 * For episodic titles (series, anime, tvshows, asian-series):
 * fetches the server-side merged total — all per-episode plays + title-level plays combined.
 * Uses the dedicated /api/view/<category>/series-total/<id> endpoint.
 */
export const getSeriesTotalViews = async (
  category: string,
  contentId: string,
): Promise<number> => {
  const r = await api.get(`/api/view/${category}/series-total/${contentId}`);
  return r.data?.views ?? 0;
};

// ─── getAllViews — single-fetch snapshot with 10-min frontend cache ──────────
//
// Replaces the old per-title enrich() loop (up to 120 individual API calls).
// Fetches the full view_counts map once, caches it in module memory for 10 min,
// and derives the top-N leaderboard purely via array math — zero extra requests.
//
// Per-title live calls (getViewCount / getSeriesTotalViews / getEpisodeViewCount)
// are intentionally kept for DetailsScreen and episode rows where real-time
// accuracy matters. This function is only for HomeScreen's "Most Viewed" section.

interface ViewEntry { category: string; id: string; views: number; }

let _viewsCache: Record<string, number> | null = null;
let _viewsCacheTs = 0;
const VIEWS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch the entire view_counts map from the backend in one request.
 * Result is cached in module memory for 10 minutes.
 * On cache hit: returns instantly with zero network usage.
 * On cache miss / expiry: fetches /api/views/all and repopulates.
 */
export const getAllViews = async (force = false): Promise<ViewEntry[]> => {
  const now = Date.now();
  const isExpired = now - _viewsCacheTs > VIEWS_CACHE_TTL;

  if (!force && _viewsCache !== null && !isExpired) {
    return _buildLeaderboard(_viewsCache);
  }

  const r = await api.get<Record<string, number>>('/api/views/all');
  _viewsCache = r.data ?? {};
  _viewsCacheTs = now;

  return _buildLeaderboard(_viewsCache);
};

/**
 * Invalidate the in-memory cache — call after a local play is recorded
 * so the next getAllViews() reflects the incremented count.
 */
export const invalidateViewsCache = (): void => {
  _viewsCacheTs = 0;
};

/**
 * Parse the raw flat map { "category:id": N, "category:id:s1ep2": N, ... }
 * into a sorted leaderboard of title-level entries only.
 * Episode-level keys (contain :s\dep\d pattern) are intentionally excluded —
 * those are subsets already reflected in the parent title key.
 */
const EPISODE_KEY_RE = /:s\d+ep\d+/;

const _buildLeaderboard = (raw: Record<string, number>): ViewEntry[] => {
  const entries: ViewEntry[] = [];

  for (const [key, views] of Object.entries(raw)) {
    // Skip episode-level keys e.g. "series:3223:s2ep9"
    if (EPISODE_KEY_RE.test(key)) continue;
    // Skip legacy URL-based keys e.g. "series:https://..."
    if (key.includes('https:') || key.includes('http:')) continue;

    const colonIdx = key.indexOf(':');
    if (colonIdx === -1) continue;

    const category = key.slice(0, colonIdx);
    const id = key.slice(colonIdx + 1);
    if (!category || !id || views <= 0) continue;

    entries.push({category, id, views});
  }

  return entries.sort((a, b) => b.views - a.views);
};
