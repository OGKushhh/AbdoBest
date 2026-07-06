/**
 * fcmService.ts
 * Handles FCM token registration and incoming notification routing.
 *
 * Call initFCM() once after the user signs in.
 * It requests permission, gets the FCM token, and registers it with your Flask backend.
 *
 * Dependencies:
 *   @react-native-firebase/messaging
 */

import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { getIdToken } from './authService';
import { API_BASE } from '../constants/endpoints';
import { loadCategory, ContentCategory, SYNC_CATEGORIES } from './metadataService';

// ─── Request permission + register token with backend ────────────────────────
export async function initFCM(): Promise<void> {
  // iOS needs explicit permission request; Android 13+ also needs it
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log('[FCM] Permission not granted');
    return;
  }

  let token: string;
  try {
    token = await messaging().getToken();
  } catch (e) {
    console.warn('[FCM] Failed to get token:', e);
    return;
  }

  await registerTokenWithBackend(token);

  // Handle token refresh (device token can change)
  messaging().onTokenRefresh(newToken => {
    registerTokenWithBackend(newToken).catch(e =>
      console.warn('[FCM] Token refresh registration failed:', e),
    );
  });
}

async function registerTokenWithBackend(fcmToken: string): Promise<void> {
  // Always register as anonymous device (for general notifications)
  try {
    await fetch(`${API_BASE}/api/register-device`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fcm_token: fcmToken }),
    });
  } catch (e) {
    console.warn('[FCM] Anonymous device registration error:', e);
  }

  // Also register with user account if signed in (for personal notifications)
  const idToken = await getIdToken();
  if (!idToken) return;
  try {
    const res = await fetch(`${API_BASE}/api/register-fcm`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id_token: idToken, fcm_token: fcmToken }),
    });
    if (res.ok) {
      console.log('[FCM] Token registered with user account');
    } else {
      console.warn('[FCM] User account registration failed:', res.status);
    }
  } catch (e) {
    console.warn('[FCM] User account registration error:', e);
  }
}

// ─── Push-triggered content sync ──────────────────────────────────────────────
// The backend's /api/notify diffs its content snapshots after every git push
// and sends an FCM data payload:
//   { type: "general_update", new_count, update_count }              — new titles / episode updates, anywhere
//   { type: "content_update", content_id, category }                 — one specific title got new episodes/season
//
// Rather than waiting for the normal 24h cache TTL to expire, we use that
// payload to force a fresh network refetch of just the affected categories
// (or, for a general update, all of them — the payload doesn't say which).
// This reuses loadCategory's existing forceRefresh path, so the on-disk
// cache + its timestamp are updated exactly the way a pull-to-refresh would —
// the 24h TTL mechanism itself is untouched, we're just resetting the clock early.
const CATEGORY_ALIAS: Record<string, ContentCategory> = {
  movies: 'movies', 'dubbed-movies': 'dubbed-movies', hindi: 'hindi',
  'asian-movies': 'asian-movies', 'anime-movies': 'anime-movies',
  anime: 'anime', series: 'series', tvshows: 'tvshows',
  'asian-series': 'asian-series', 'arabic-series': 'arabic-series',
};

export async function syncContentFromPush(data: Record<string, string>): Promise<void> {
  const type = data?.type;
  if (type !== 'general_update' && type !== 'content_update') return;

  const categories: ContentCategory[] =
    type === 'content_update'
      ? [CATEGORY_ALIAS[data.category ?? '']].filter(Boolean) as ContentCategory[]
      : SYNC_CATEGORIES;

  if (categories.length === 0) return;

  await Promise.all(
    categories.map(cat =>
      loadCategory(cat, true).catch(e =>
        console.warn(`[FCM] Push-triggered refresh failed for ${cat}:`, e?.message),
      ),
    ),
  );
  console.log(`[FCM] Push-triggered content sync done (${type}) — ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`);
}

// ─── Foreground message handler ───────────────────────────────────────────────
// When the app is open, FCM doesn't show a system notification automatically.
// We handle it here and can show an in-app banner instead.
export function setupForegroundHandler(
  onNotification: (title: string, body: string, data: Record<string, string>) => void,
): () => void {
  return messaging().onMessage(async remoteMessage => {
    const title = remoteMessage.notification?.title ?? '';
    const body  = remoteMessage.notification?.body  ?? '';
    const data  = (remoteMessage.data ?? {}) as Record<string, string>;
    console.log('[FCM] Foreground message:', title, body);
    syncContentFromPush(data).catch(() => {});
    onNotification(title, body, data);
  });
}

// ─── Background / quit notification tap handler ───────────────────────────────
// Call this in App.tsx to handle what happens when the user taps a notification
// that arrived while the app was in background or closed.
// `onTap` receives the data payload — use content_id + category to navigate.
export function setupNotificationOpenedHandler(
  onTap: (data: Record<string, string>) => void,
): void {
  // App opened from background by tapping notification
  messaging().onNotificationOpenedApp(remoteMessage => {
    const data = (remoteMessage.data ?? {}) as Record<string, string>;
    console.log('[FCM] Notification opened app from background:', data);
    syncContentFromPush(data).catch(() => {});
    onTap(data);
  });

  // App launched from quit state by tapping notification
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        const data = (remoteMessage.data ?? {}) as Record<string, string>;
        console.log('[FCM] App launched from notification:', data);
        syncContentFromPush(data).catch(() => {});
        onTap(data);
      }
    });
}

// ─── Background message handler (must be registered outside React tree) ───────
// Call this at the top of index.js, before AppRegistry.registerComponent
export function registerBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    // System tray handles display automatically — we just piggyback the sync.
    console.log('[FCM] Background message received:', remoteMessage.messageId);
    const data = (remoteMessage.data ?? {}) as Record<string, string>;
    try {
      await syncContentFromPush(data);
    } catch (e) {
      console.warn('[FCM] Background sync failed:', e);
    }
  });
}
