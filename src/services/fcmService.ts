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
  const idToken = await getIdToken();
  if (!idToken) {
    console.warn('[FCM] No Firebase ID token — skipping backend registration');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/register-fcm`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id_token: idToken, fcm_token: fcmToken }),
    });
    if (res.ok) {
      console.log('[FCM] Token registered with backend');
    } else {
      console.warn('[FCM] Backend registration failed:', res.status);
    }
  } catch (e) {
    console.warn('[FCM] Backend registration error:', e);
  }
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
    onTap(data);
  });

  // App launched from quit state by tapping notification
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        const data = (remoteMessage.data ?? {}) as Record<string, string>;
        console.log('[FCM] App launched from notification:', data);
        onTap(data);
      }
    });
}

// ─── Background message handler (must be registered outside React tree) ───────
// Call this at the top of index.js, before AppRegistry.registerComponent
export function registerBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    // Nothing to do — system tray handles display automatically
    console.log('[FCM] Background message received:', remoteMessage.messageId);
  });
}
