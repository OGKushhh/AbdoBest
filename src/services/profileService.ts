/**
 * profileService.ts
 * Editable app-level profile: name, gender, preferred genres, avatar.
 *
 * Distinct from Firebase Auth's built-in displayName/photoURL (which only
 * exist for Google sign-in). This is stored server-side under
 * the same /data/users/{uid}.json record as favorites/watched, in a
 * "profile" key — see app.py.
 *
 * ProfileScreen prefers these values when set, falling back to the
 * Firebase Auth user object (see getDisplayName/getAvatarUrl helpers).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {getIdToken} from './authService';
import {API_BASE} from '../constants/endpoints';

export interface UserProfile {
  name: string;
  gender: 'male' | 'female' | 'other' | '';
  genres: string[];
  avatar: string | null;   // filename on the server, e.g. "uid123.jpg" — not a full URL
}

const EMPTY_PROFILE: UserProfile = {name: '', gender: '', genres: [], avatar: null};

const PROFILE_CACHE_KEY = 'user_profile_cache';

// ─── Local cache (instant UI, same pattern as favoritesService) ──────────────
async function readLocalProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? {...EMPTY_PROFILE, ...JSON.parse(raw)} : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

async function writeLocalProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // non-fatal — server remains source of truth
  }
}

export async function clearProfileCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore
  }
}

/** Full URL for displaying a stored avatar — null if none set. */
export function avatarUrlFor(uid: string | null | undefined): string | null {
  if (!uid) return null;
  return `${API_BASE}/api/profile/avatar/${uid}`;
}

// ─── Server sync ───────────────────────────────────────────────────────────
export async function fetchProfile(): Promise<UserProfile> {
  const token = await getIdToken();
  if (!token) return readLocalProfile();

  try {
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: {Authorization: `Bearer ${token}`},
    });
    if (!res.ok) throw new Error(`fetchProfile failed: ${res.status}`);
    const data = await res.json();
    const profile: UserProfile = {...EMPTY_PROFILE, ...data.profile};
    await writeLocalProfile(profile);
    return profile;
  } catch (e) {
    console.warn('[Profile] fetch failed, using local cache:', (e as Error)?.message);
    return readLocalProfile();
  }
}

/** Partial update — only send the fields that changed. */
export async function updateProfile(
  updates: Partial<Pick<UserProfile, 'name' | 'gender' | 'genres'>>,
): Promise<UserProfile> {
  const token = await getIdToken();
  if (!token) throw new Error('Not signed in');

  const res = await fetch(`${API_BASE}/api/profile`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `updateProfile failed: ${res.status}`);
  }
  const data = await res.json();
  const profile: UserProfile = {...EMPTY_PROFILE, ...data.profile};
  await writeLocalProfile(profile);
  return profile;
}

/**
 * Upload an avatar image. `fileUri` is a local file:// URI (e.g. from
 * react-native-image-picker). Resizing/compression happens server-side —
 * see app.py's /api/profile/avatar (center-crop to square, 320x320, JPEG q85).
 */
export async function uploadAvatar(fileUri: string): Promise<string> {
  const token = await getIdToken();
  if (!token) throw new Error('Not signed in');

  const form = new FormData();
  form.append('avatar', {
    uri: fileUri,
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as any);

  const res = await fetch(`${API_BASE}/api/profile/avatar`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `uploadAvatar failed: ${res.status}`);
  }
  const data = await res.json();

  // Reflect immediately in the local cache so the UI updates without a
  // re-fetch. The exact value doesn't matter — avatarUrlFor(uid) is what
  // actually builds the display URL — this just needs to be non-null so
  // ProfileScreen knows to show the image instead of the initials fallback.
  const current = await readLocalProfile();
  await writeLocalProfile({...current, avatar: 'set'});

  return data.avatar_url as string;
}
