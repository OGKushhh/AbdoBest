import axios from 'axios';
import {Platform, Linking} from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import {GITHUB_RELEASES_URL, APP_VERSION} from '../constants/endpoints';
import {storage} from '../storage/Storage';

export interface ReleaseInfo {
  version: string;
  downloadUrl: string;
  changelog: string;
  publishedAt: string;
  assetName: string;
}

export interface DownloadProgress {
  percent: number;          // 0–100
  receivedBytes: number;
  totalBytes: number;
  bytesPerSecond: number;   // rolling speed estimate
}

/**
 * Compare two semver version strings.
 * Returns: positive if v1 > v2, negative if v1 < v2, 0 if equal
 */
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.replace('v', '').split('.').map(Number);
  const parts2 = v2.replace('v', '').split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 !== p2) return p1 - p2;
  }
  return 0;
};

/**
 * Check GitHub Releases for the latest version.
 * Returns release info if an update is available, null otherwise.
 */
export const checkForUpdate = async (): Promise<ReleaseInfo | null> => {
  try {
    const response = await axios.get(GITHUB_RELEASES_URL, {
      timeout: 10000,
      headers: {'Accept': 'application/vnd.github.v3+json'},
    });

    const release = response.data;

    if (!release || !release.tag_name) {
      return null;
    }

    const latestVersion = release.tag_name.replace('v', '');

    // Check if user has skipped this version
    const skippedVersion = storage.getString('skipped_update_version');
    if (skippedVersion === latestVersion) {
      return null;
    }

    // Compare versions
    if (compareVersions(latestVersion, APP_VERSION) <= 0) {
      return null;
    }

    // Find the right asset for this platform
    const asset = Platform.OS === 'ios'
      ? release.assets?.find((a: any) => a.name.endsWith('.ipa'))
      : release.assets?.find(
          (a: any) =>
            a.name.endsWith('.apk') ||
            a.content_type === 'application/vnd.android.package-archive'
        );

    const downloadUrl = asset?.browser_download_url || release.html_url;

    return {
      version: latestVersion,
      downloadUrl,
      changelog: release.body || '',
      publishedAt: release.published_at,
      assetName: asset?.name || (Platform.OS === 'ios' ? 'AbdoBest.ipa' : 'AbdoBest.apk'),
    };
  } catch (error: any) {
    // Silently fail — update check shouldn't break the app
    console.log('[OTA] Update check failed:', error?.message);
    return null;
  }
};

/**
 * Mark a version as skipped so user won't be prompted again for this version
 */
export const skipVersion = (version: string) => {
  storage.set('skipped_update_version', version);
};

/**
 * Open the update download URL in the device browser.
 * Used for iOS always, and as the Android fallback if the in-app
 * download/install below fails for any reason.
 */
export const openUpdateUrl = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

/**
 * Android only: download the APK straight into the app's private cache dir
 * (no storage permission needed — this is why we don't touch
 * WRITE/READ_EXTERNAL_STORAGE for this), then hand it to the system
 * installer via a content:// URI through react-native-blob-util's
 * FileProvider (declared explicitly in AndroidManifest.xml — see the
 * comment there for why).
 *
 * Throws on any failure — the caller should catch and fall back to
 * openUpdateUrl() so the user can still update via the browser.
 */
export const downloadAndInstallApk = async (
  release: ReleaseInfo,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> => {
  if (Platform.OS !== 'android') {
    throw new Error('downloadAndInstallApk is Android-only');
  }

  const destPath = `${RNBlobUtil.fs.dirs.CacheDir}/update-${release.version}.apk`;

  // Clean up any partial file from a previous failed attempt
  try {
    if (await RNBlobUtil.fs.exists(destPath)) {
      await RNBlobUtil.fs.unlink(destPath);
    }
  } catch {
    // non-fatal — fetch will just overwrite/fail on its own below
  }

  let lastBytes = 0;
  let lastTs = Date.now();

  const res = await RNBlobUtil
    .config({path: destPath, timeout: 60000})
    .fetch('GET', release.downloadUrl)
    .progress({interval: 250}, (received, total) => {
      const receivedBytes = Number(received);
      const totalBytes = Number(total);
      const now = Date.now();
      const deltaBytes = receivedBytes - lastBytes;
      const deltaSec = Math.max((now - lastTs) / 1000, 0.001);
      const bytesPerSecond = deltaBytes / deltaSec;
      lastBytes = receivedBytes;
      lastTs = now;

      onProgress({
        percent: totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0,
        receivedBytes,
        totalBytes,
        bytesPerSecond: Math.max(0, bytesPerSecond),
      });
    });

  const filePath = res.path();

  // Android 8+ requires this permission be granted for the specific installer flow;
  // if missing, the system shows its own "allow from this source" screen automatically
  // when actionViewIntent below fires — no extra code needed on our end for that prompt.
  await RNBlobUtil.android.actionViewIntent(filePath, 'application/vnd.android.package-archive');
};
