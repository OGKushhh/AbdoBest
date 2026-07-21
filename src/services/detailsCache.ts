/**
 * detailsCache.ts
 *
 * Client-side cache for the two/three network calls DetailsScreen makes per
 * title: the episode list, the aggregate view count, and (for episodic
 * titles) the per-episode view count fan-out.
 *
 * Why: these all appear to hit the backend's Hugging Face Hub API calls,
 * which are rate-limited over a shared 5-minute window across ALL users —
 * not a per-device limit. The per-episode fan-out is the worst offender
 * (N requests per single details-screen open), so it's included here too,
 * not just the two "headline" fetches.
 *
 * Cache is in-memory only (module scope), not persisted to MMKV — a killed
 * and relaunched app should always fetch fresh, this is purely about
 * smoothing out repeat visits within a session (e.g. backing out to the
 * category list and reopening the same title).
 *
 * Invalidation happens two ways:
 *  1. Push-triggered: syncContentFromPush() in fcmService.ts calls
 *     invalidateDetailsCache()/clearAllDetailsCache() when the notify
 *     system's FCM payload indicates a specific title (or everything)
 *     changed — so a fresh push about new episodes is never masked by a
 *     stale cache entry.
 *  2. Play-triggered: DetailsScreen invalidates a title's entry the moment
 *     the user presses play, so the *next* time they open that title within
 *     the TTL window, it re-fetches the real server count instead of
 *     serving a pre-play snapshot. The instant on-screen bump is separate,
 *     local React state — this only affects what a later reopen sees.
 */

export interface DetailsCacheEntry {
  ts: number;
  /** Aggregate view count (series total or single-title view count). null = not yet cached. */
  liveViews: number | null;
  /** Normalized episode data for non-arabic-series episodic titles (series/tvshows/asian-series/anime). */
  epData: any | null;
  /** Flat episode array for arabic-series titles. */
  arabicEpisodes: any[] | null;
  /** Per-episode view counts, keyed by episode URL. */
  episodeViews: Record<string, number>;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes — matches the Hub API's rate-limit window
const _cache = new Map<string, DetailsCacheEntry>();

const cacheKey = (category: string, id: string): string => `${category}:${id}`;

/** Returns the cached entry if present and still within the 5-min TTL, else null. */
export const getDetailsCache = (category: string, id: string): DetailsCacheEntry | null => {
  if (!category || !id) return null;
  const key = cacheKey(category, id);
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry;
};

/**
 * Merge new data into a title's cache entry. Each fetch (episodes, live
 * views, per-episode views) can arrive at a different time, so this merges
 * rather than overwrites, and refreshes `ts` on every write so the TTL
 * covers "time since last update" for this title.
 */
export const setDetailsCache = (
  category: string,
  id: string,
  patch: Partial<Omit<DetailsCacheEntry, 'ts'>>,
): void => {
  if (!category || !id) return;
  const key = cacheKey(category, id);
  const existing = _cache.get(key);
  _cache.set(key, {
    ts: Date.now(),
    liveViews: existing?.liveViews ?? null,
    epData: existing?.epData ?? null,
    arabicEpisodes: existing?.arabicEpisodes ?? null,
    episodeViews: existing?.episodeViews ?? {},
    ...patch,
  });
};

/** Invalidate one specific title — called on a targeted `content_update` push. */
export const invalidateDetailsCache = (category: string, id: string): void => {
  if (!category || !id) return;
  _cache.delete(cacheKey(category, id));
};

/** Invalidate everything — called on a `general_update` push (no specific id to target). */
export const clearAllDetailsCache = (): void => {
  _cache.clear();
};
