/**
 * Video Download Manager for AbdoBest.
 *
 * Architecture:
 *  ┌──────────────────┐
 *  │ @rajeev02/media  │  ← Handles actual HLS/m3u8 → .mp4 download
 *  │ (cross-platform) │     Supports Android & iOS natively
 *  └────────┬─────────┘
 *           │ onProgress, onComplete, onError callbacks
 *  ┌────────▼─────────┐
 *  │ videoDownloadMgr  │  ← Orchestrates: extract → download → save
 *  │   (this file)     │     Manages queue, retry, MMKV cache
 *  └────────┬─────────┘
 *           │
 *  ┌────────▼─────────┐
 *  │  Storage Layer    │
 *  ├──────────────────┤
 *  │ MMKV             │  ← Queue, settings, URL cache (6h TTL)
 *  │ Nitro FS         │  ← Large file I/O (movies.json, file moves)
 *  └──────────────────┘
 *
 * Key behaviors:
 *  - m3u8 URLs are handled natively by @rajeev02/media (not as raw files)
 *  - Size estimation uses onProgress from @rajeev02/media (segment-based)
 *  - Extracted video URLs are cached in MMKV for 6 hours (no re-extraction)
 *  - Metadata persists indefinitely in MMKV; only URL cache has 6h TTL
 *  - Both Android and iOS fully supported
 */

import {Platform} from 'react-native';
import {storage, storageKeys} from '../storage';
import {extractVideoUrl} from './api';
import {getVideoUrlCache} from '../storage/cache';
import {getDownloadDirectory, sanitizeFileName} from './platform';
import {DownloadItem} from '../types';

// ─── Download Queue Persistence ────────────────────────────────────

const QUEUE_KEY = storageKeys.DOWNLOADS_LIST;

/** Load the download queue from MMKV */
export const getDownloadQueue = (): DownloadItem[] => {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DownloadItem[];
  } catch {
    return [];
  }
};

/** Save the download queue to MMKV */
const saveDownloadQueue = (queue: DownloadItem[]) => {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
};

/** Add or update a download item in the queue */
const updateQueueItem = (item: DownloadItem) => {
  const queue = getDownloadQueue();
  const idx = queue.findIndex(d => d.id === item.id);
  if (idx >= 0) {
    queue[idx] = item;
  } else {
    queue.push(item);
  }
  saveDownloadQueue(queue);
};

/** Remove a download item from the queue */
export const removeDownloadItem = (downloadId: string) => {
  const queue = getDownloadQueue().filter(d => d.id !== downloadId);
  saveDownloadQueue(queue);
};

// ─── Video URL Resolution (with 6h MMKV cache) ────────────────────

/**
 * Get a playable/downloadable video URL for a content item.
 *
 * Resolution order:
 *  1. Check MMKV for a cached URL (6h TTL) → reuse immediately
 *  2. Call the /extract backend endpoint → cache result in MMKV
 *
 * This means:
 *  - First download: extract → store URL + timestamp in MMKV
 *  - Retry within 6h: use cached URL immediately (NO extra extraction calls)
 *  - Retry after 6h: re-extract once, cache again
 */
const resolveVideoUrl = async (
  sourceUrl: string,
): Promise<{video_url: string; quality_options: string[]}> => {
  // 1. Check MMKV cache (6h TTL) — already implemented in cache.ts + api.ts
  const cached = getVideoUrlCache(sourceUrl);
  if (cached) {
    console.log('[DownloadManager] Using cached video URL (within 6h TTL)');
    return {video_url: cached.url, quality_options: cached.qualities};
  }

  // 2. Cache miss or expired → extract via backend
  console.log('[DownloadManager] Cache miss, extracting video URL...');
  return extractVideoUrl(sourceUrl);
};

// ─── Download Execution ────────────────────────────────────────────

export interface DownloadCallbacks {
  onProgress?: (downloadId: string, progress: number) => void;
  onCompleted?: (downloadId: string, localPath: string) => void;
  onError?: (downloadId: string, error: string) => void;
}

/**
 * Start a video download for a given content item.
 *
 * Flow:
 *  1. Resolve video URL (MMKV cache → /extract endpoint)
 *  2. Create DownloadItem and add to queue (status: 'pending')
 *  3. Start download via @rajeev02/media
 *  4. Update progress via onProgress callback from @rajeev02/media
 *  5. On completion: save file, update queue (status: 'completed')
 *  6. On error: update queue (status: 'failed'), store error message
 *
 * @rajeev02/media handles:
 *  - HLS/m3u8 stream downloading (segment-by-segment)
 *  - Progress reporting based on segments (no pre-download size needed)
 *  - Cross-platform support (Android native HLS + iOS AVAssetDownload)
 *  - Output as .mp4
 */
export const startDownload = async (
  contentId: string,
  title: string,
  sourceUrl: string,
  imageUrl: string,
  format: string,
  callbacks?: DownloadCallbacks,
): Promise<DownloadItem> => {
  const downloadId = `dl_${contentId}_${Date.now()}`;
  const quality = '1080p'; // Default quality

  // Create queue entry
  const downloadItem: DownloadItem = {
    id: downloadId,
    contentId,
    title,
    imageUrl,
    videoUrl: '',
    format,
    quality,
    progress: 0,
    status: 'pending',
    timestamp: Date.now(),
  };
  updateQueueItem(downloadItem);

  try {
    // Step 1: Resolve video URL (MMKV 6h cache → /extract)
    const {video_url} = await resolveVideoUrl(sourceUrl);
    downloadItem.videoUrl = video_url;
    downloadItem.status = 'downloading';
    updateQueueItem(downloadItem);

    // Step 2: Build destination path (platform-specific)
    const destDir = getDownloadDirectory();
    const fileName = sanitizeFileName(`${title}_${quality}.mp4`);
    const destinationPath = `${destDir}${fileName}`;
    downloadItem.destinationPath = destinationPath;

    // Step 3: Download via @rajeev02/media
    // @rajeev02/media handles m3u8 natively — it downloads all segments
    // and muxes them into a single .mp4 file.
    //
    // The library is imported dynamically to avoid issues on platforms
    // where it hasn't been linked yet.
    const MediaModule = require('@rajeev02/media');

    await MediaModule.download({
      url: video_url,
      destination: destinationPath,
      onProgress: (progressData: {bytesWritten: number; bytesTotal?: number; progress: number}) => {
        // @rajeev02/media reports progress based on HLS segments
        // progress is 0-100 (percentage)
        const progress = progressData.progress || progressData.bytesWritten;
        downloadItem.progress = Math.min(progress, 100);
        downloadItem.downloadedBytes = progressData.bytesWritten;
        downloadItem.totalBytes = progressData.bytesTotal;
        updateQueueItem(downloadItem);
        callbacks?.onProgress?.(downloadId, downloadItem.progress);
      },
    });

    // Step 4: Download complete
    downloadItem.status = 'completed';
    downloadItem.progress = 100;
    downloadItem.localPath = destinationPath;
    updateQueueItem(downloadItem);
    callbacks?.onCompleted?.(downloadId, destinationPath);

    return downloadItem;
  } catch (error: any) {
    // Download failed
    downloadItem.status = 'failed';
    downloadItem.errorMessage = error.message || 'Download failed';
    updateQueueItem(downloadItem);
    callbacks?.onError?.(downloadId, downloadItem.errorMessage!);
    return downloadItem;
  }
};

// ─── Queue Management ──────────────────────────────────────────────

/**
 * Retry a failed download.
 * Uses the MMKV-cached video URL if still within 6h TTL.
 */
export const retryDownload = async (
  downloadId: string,
  callbacks?: DownloadCallbacks,
): Promise<DownloadItem | null> => {
  const queue = getDownloadQueue();
  const item = queue.find(d => d.id === downloadId);
  if (!item) return null;

  // Reset status and retry
  item.status = 'pending';
  item.progress = 0;
  item.errorMessage = undefined;
  updateQueueItem(item);

  return startDownload(
    item.contentId,
    item.title,
    item.videoUrl || '', // Will be re-resolved via MMKV cache
    item.imageUrl,
    item.format,
    callbacks,
  );
};

/** Cancel an active download */
export const cancelDownload = (downloadId: string) => {
  const queue = getDownloadQueue();
  const item = queue.find(d => d.id === downloadId);
  if (item) {
    item.status = 'failed';
    item.errorMessage = 'Cancelled by user';
    updateQueueItem(item);
  }
  // Note: @rajeev02/media cancellation would go here if the lib supports it
};

/** Clear all completed downloads from the queue (keep active/failed) */
export const clearCompletedDownloads = () => {
  const queue = getDownloadQueue().filter(
    d => d.status !== 'completed'
  );
  saveDownloadQueue(queue);
};

/** Get total size of all completed downloads (approximate) */
export const getTotalDownloadedSize = (): number => {
  return getDownloadQueue()
    .filter(d => d.status === 'completed' && d.totalBytes)
    .reduce((sum, d) => sum + (d.totalBytes || 0), 0);
};
