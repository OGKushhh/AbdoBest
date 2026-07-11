/**
 * authService.ts
 * Handles Google, Email, Phone, and guest sign-in via Firebase Auth.
 * Persists the current user to AsyncStorage so session survives app restarts.
 *
 * Dependencies to install:
 *   @react-native-google-signin/google-signin
 *   @react-native-firebase/app
 *   @react-native-firebase/auth
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage key ────────────────────────────────────────────────────────────
const AUTH_USER_KEY = 'auth_user';

// ─── Types ──────────────────────────────────────────────────────────────────
export type AuthProvider = 'google' | 'email' | 'phone' | 'guest';

export interface AbdoUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isGuest: boolean;
  provider: AuthProvider;
}

// ─── Init (call once at app startup) ────────────────────────────────────────
export function initAuth() {
  GoogleSignin.configure({
    // Get this from your Firebase project:
    // Firebase Console → Project settings → Your apps → Web client ID
    webClientId: 'YOUR_WEB_CLIENT_ID_HERE',
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function mapFirebaseUser(fbUser: FirebaseAuthTypes.User): AbdoUser {
  let provider: AuthProvider = 'email';
  if (fbUser.isAnonymous) {
    provider = 'guest';
  } else if (fbUser.providerData.some(p => p.providerId === 'google.com')) {
    provider = 'google';
  } else if (fbUser.providerData.some(p => p.providerId === 'phone')) {
    provider = 'phone';
  } else if (fbUser.providerData.some(p => p.providerId === 'password')) {
    provider = 'email';
  }

  return {
    uid:         fbUser.uid,
    displayName: fbUser.displayName,
    email:       fbUser.email,
    photoURL:    fbUser.photoURL,
    isGuest:     fbUser.isAnonymous,
    provider,
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

// ─── Guest sign-in (anonymous) ───────────────────────────────────────────────
export async function signInAsGuest(): Promise<AbdoUser> {
  const result = await auth().signInAnonymously();
  const user = mapFirebaseUser(result.user);
  await persistUser(user);
  return user;
}

// ─── Email + Password ────────────────────────────────────────────────────────
export async function signInWithEmail(email: string, password: string): Promise<AbdoUser> {
  const result = await auth().signInWithEmailAndPassword(email, password);
  const user = mapFirebaseUser(result.user);
  await persistUser(user);
  return user;
}

export async function signUpWithEmail(email: string, password: string): Promise<AbdoUser> {
  const result = await auth().createUserWithEmailAndPassword(email, password);
  await result.user.sendEmailVerification();
  const user = mapFirebaseUser(result.user);
  await persistUser(user);
  return user;
}

export async function resetPassword(email: string): Promise<void> {
  await auth().sendPasswordResetEmail(email);
}

// ─── Phone OTP ───────────────────────────────────────────────────────────────
export async function sendPhoneOTP(phoneNumber: string): Promise<any> {
  const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
  return confirmation;
}

export async function confirmPhoneOTP(confirmation: any, code: string): Promise<AbdoUser> {
  const result = await confirmation.confirm(code);
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
