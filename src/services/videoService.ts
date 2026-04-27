/**
 * Video Service for AbdoBest.
 *
 * Handles:
 *  - Stream URL resolution (with MMKV 6h URL cache)
 *  - Download state persistence (via MMKV)
 *
 * Actual video downloading is handled by videoDownloadManager.ts
 * using @rajeev02/media for HLS/m3u8 support.
 *
 * Storage architecture:
 *  - @rajeev02/media → video download (HLS → .mp4, cross-platform)
 *  - MMKV → download queue, settings, URL cache (6h TTL)
 *  - Nitro FS → large file I/O (movies.json reads/writes, file moves)
 *
 * Metadata persistence:
 *  - Cached metadata (movies, series, anime catalogs) persists INDEFINITELY
 *    in MMKV until the user clears cache or uninstalls
 *  - The 24h TTL only controls when to RE-FETCH from the server
 *  - The 6h TTL only applies to extracted video URL reuse
 *  - Completed downloads, user preferences, and cached catalogs persist
 *    forever (until user clears data or uninstalls)
 */

import {extractVideoUrl, refreshVideoUrl} from './api';
import {storage} from '../storage';
import {storageKeys} from '../storage';

export interface VideoServiceCallbacks {
  onProgress?: (progress: number) => void;
  onCompleted?: (localPath: string) => void;
  onError?: (error: string) => void;
}

/**
 * Get a stream URL for a content item.
 * Uses MMKV cache (6h TTL) to avoid redundant /extract calls.
 *
 * URL caching behavior:
 *  - First call → extract from backend → cache in MMKV with 6h timestamp
 *  - Within 6h → return cached URL immediately (no network call)
 *  - After 6h → re-extract once, update cache
 *  - This is NOT session-based — the cache persists across app restarts
 */
export const getStreamUrl = async (contentId: string, sourceUrl: string) => {
  if (!sourceUrl) {
    throw new Error('No source URL available for this content');
  }
  return extractVideoUrl(sourceUrl);
};

/**
 * Force-refresh a stream URL (bypasses cache).
 */
export const getRefreshedStreamUrl = async (cacheKey: string, sourceUrl: string) => {
  return refreshVideoUrl(cacheKey);
};

/**
 * Persist download state to MMKV.
 * This data persists indefinitely (not session-based).
 */
export const saveDownloadState = (downloads: any[]) => {
  storage.set(storageKeys.DOWNLOADS_LIST, JSON.stringify(downloads));
};

/**
 * Load download state from MMKV.
 * Survives app restarts, device reboots, and process kills.
 */
export const getDownloadState = (): any[] => {
  const raw = storage.getString(storageKeys.DOWNLOADS_LIST);
  return raw ? JSON.parse(raw) : [];
};
