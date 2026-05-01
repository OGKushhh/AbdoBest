/**
 * View Tracking Service
 *
 * On play → increment local pending count (MMKV)
 * Every 24 h → batch-POST all pending counts to /api/view/:category/:id
 * On app launch → also try sync if overdue
 */

import {storage} from '../storage';
import {postViewCount} from './api';

const PENDING_PREFIX = 'vpend:';       // vpend:category:id → count
const INDEX_KEY      = 'vpend_index';  // JSON array of "category:id" keys
const LAST_SYNC_KEY  = 'view_last_sync';
const SYNC_INTERVAL  = 24 * 60 * 60 * 1000; // 24 h

// ── Public API ───────────────────────────────────────────────────────

/** Call when user presses Play on any title. */
export const recordPlay = (contentId: string, category: string): void => {
  if (!contentId || !category) return;
  const compositeKey = `${category}:${contentId}`;
  const storageKey = `${PENDING_PREFIX}${compositeKey}`;

  // Bump pending counter
  const current = storage.getNumber(storageKey) ?? 0;
  storage.set(storageKey, current + 1);

  // Track in index
  const index = readIndex();
  if (!index.includes(compositeKey)) {
    index.push(compositeKey);
    writeIndex(index);
  }

  // Non-blocking sync attempt
  trySyncViews().catch(() => {});
};

/** Force-sync regardless of 24 h timer. Safe to call on startup. */
export const forceSyncViews = async (): Promise<void> => {
  const index = readIndex();
  if (!index.length) return;

  const results = await Promise.allSettled(
    index.map(async (compositeKey) => {
      const [category, ...rest] = compositeKey.split(':');
      const contentId = rest.join(':');
      const count = storage.getNumber(`${PENDING_PREFIX}${compositeKey}`) ?? 0;
      if (count <= 0) return;
      await postViewCount(category, contentId, count);
      // Clear on success
      storage.delete(`${PENDING_PREFIX}${compositeKey}`);
      return compositeKey;
    })
  );

  // Prune index — remove keys we successfully sent
  const sent = results
    .filter((r): r is PromiseFulfilledResult<string | undefined> => r.status === 'fulfilled' && !!r.value)
    .map(r => r.value as string);
  const remaining = index.filter(k => !sent.includes(k));
  writeIndex(remaining);

  storage.set(LAST_SYNC_KEY, Date.now());
};

/** Sync only if 24 h has elapsed since last sync. */
export const trySyncViews = async (): Promise<void> => {
  const lastSync = storage.getNumber(LAST_SYNC_KEY) ?? 0;
  if (Date.now() - lastSync < SYNC_INTERVAL) return;
  await forceSyncViews();
};

// ── Helpers ──────────────────────────────────────────────────────────

const readIndex = (): string[] => {
  try {
    return JSON.parse(storage.getString(INDEX_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const writeIndex = (index: string[]) => {
  storage.set(INDEX_KEY, JSON.stringify(index));
};
