/**
 * authService.ts
 * Handles Google, Facebook, and guest sign-in via Firebase Auth.
 * Persists the current user to AsyncStorage so session survives app restarts.
 *
 * Dependencies to install:
 *   @react-native-google-signin/google-signin
 *   react-native-fbsdk-next
 *   @react-native-firebase/app
 *   @react-native-firebase/auth
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage key ────────────────────────────────────────────────────────────
const AUTH_USER_KEY = 'auth_user';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface AbdoUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isGuest: boolean;
}

// ─── Init (call once at app startup) ────────────────────────────────────────
export function initAuth() {
  GoogleSignin.configure({
    // Get this from your Firebase project:
    // Firebase Console → Project settings → Your apps → Web client ID
    webClientId: '682674226016-hkadmadbqggc6t55kplorpac6mnbv39k.apps.googleusercontent.com',
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function mapFirebaseUser(fbUser: FirebaseAuthTypes.User): AbdoUser {
  return {
    uid:         fbUser.uid,
    displayName: fbUser.displayName,
    email:       fbUser.email,
    photoURL:    fbUser.photoURL,
    isGuest:     fbUser.isAnonymous,
  };
}

async function persistUser(user: AbdoUser | null) {
  if (user) {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  }
}

// ─── Get persisted user (for app startup — before Firebase resolves) ─────────
export async function getPersistedUser(): Promise<AbdoUser | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Get current Firebase ID token (for API calls) ──────────────────────────
export async function getIdToken(): Promise<string | null> {
  try {
    const user = auth().currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

// ─── Google sign-in ──────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<AbdoUser> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const { data } = await GoogleSignin.signIn();
  if (!data?.idToken) throw new Error('Google sign-in failed — no ID token');
  const credential = auth.GoogleAuthProvider.credential(data.idToken);
  const result = await auth().signInWithCredential(credential);
  const user = mapFirebaseUser(result.user);
  await persistUser(user);
  return user;
}

// ─── Facebook sign-in ────────────────────────────────────────────────────────
export async function signInWithFacebook(): Promise<AbdoUser> {
  const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (result.isCancelled) throw new Error('Facebook sign-in cancelled');
  const data = await AccessToken.getCurrentAccessToken();
  if (!data?.accessToken) throw new Error('Facebook sign-in failed — no access token');
  const credential = auth.FacebookAuthProvider.credential(data.accessToken);
  const fbResult = await auth().signInWithCredential(credential);
  const user = mapFirebaseUser(fbResult.user);
  await persistUser(user);
  return user;
}

// ─── Guest sign-in (anonymous) ───────────────────────────────────────────────
export async function signInAsGuest(): Promise<AbdoUser> {
  const result = await auth().signInAnonymously();
  const user = mapFirebaseUser(result.user);
  await persistUser(user);
  return user;
}

// ─── Sign out ────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  const user = auth().currentUser;
  if (!user) return;

  // Sign out from Google if that was the provider
  try {
    const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');
    if (isGoogleUser) { try { await GoogleSignin.revokeAccess(); } catch {} await GoogleSignin.signOut(); }
  } catch { /* ignore */ }

  // Sign out from Facebook if that was the provider
  try {
    const isFbUser = user.providerData.some(p => p.providerId === 'facebook.com');
    if (isFbUser) LoginManager.logOut();
  } catch { /* ignore */ }

  await auth().signOut();
  await persistUser(null);
}

// ─── Firebase auth state listener ────────────────────────────────────────────
// Use this in App.tsx or an AuthContext to reactively update UI
export function onAuthStateChanged(
  callback: (user: AbdoUser | null) => void,
): () => void {
  return auth().onAuthStateChanged(async fbUser => {
    if (fbUser) {
      const user = mapFirebaseUser(fbUser);
      await persistUser(user);
      callback(user);
    } else {
      await persistUser(null);
      callback(null);
    }
  });
}
