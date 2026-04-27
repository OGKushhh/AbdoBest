import {Platform} from 'react-native';

/**
 * Platform-specific utilities for AbdoBest.
 *
 * Both Android and iOS are fully supported:
 *  - Video downloads via @rajeev02/media (HLS → .mp4, cross-platform)
 *  - File operations via react-native-nitro-fs (large file I/O, cross-platform)
 *  - Metadata & cache via react-native-mmkv (cross-platform)
 *
 * The ONLY platform-specific logic is the download destination path:
 *  - Android: /storage/emulated/0/Download/AbdoBest/
 *  - iOS:     DocumentDirectoryPath/AbdoBest/
 */

export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';

/**
 * Get the platform-appropriate download directory.
 *
 * On Android, downloads go to the public Downloads folder so users
 * can access them from any file manager. On iOS, the app sandbox
 * restricts access to the document directory.
 *
 * NOTE: Background downloads on iOS require `UIBackgroundModes` in
 * Info.plist. @rajeev02/media handles this automatically when
 * configured properly.
 */
export const getDownloadDirectory = (): string => {
  if (isAndroid) {
    return '/storage/emulated/0/Download/AbdoBest/';
  }

  // iOS — @rajeev02/media / nitro-fs resolves the document directory at runtime.
  // We import lazily to avoid issues on Android where the module may not be needed.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {dirs} = require('react-native-nitro-fs');
    return `${dirs.DocumentDir}/AbdoBest/`;
  } catch {
    // Fallback: let @rajeev02/media handle the path
    return 'AbdoBest/';
  }
};

/**
 * Sanitize a filename by removing invalid characters.
 * Works for both platforms (Android ext4/fat32 and iOS APFS).
 */
export const sanitizeFileName = (name: string): string => {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')   // Remove invalid chars
    .replace(/\s+/g, '_')                       // Spaces → underscores
    .replace(/_{2,}/g, '_')                     // Collapse multiple underscores
    .substring(0, 200);                         // Limit length
};

/**
 * Build a full file path for a downloaded video.
 */
export const getDownloadFilePath = (title: string, quality: string): string => {
  const dir = getDownloadDirectory();
  const fileName = sanitizeFileName(`${title}_${quality}.mp4`);
  return `${dir}${fileName}`;
};

/**
 * Platform-specific info for logging / debugging.
 */
export const getPlatformInfo = () => ({
  os: Platform.OS,
  version: Platform.Version,
  downloadDir: getDownloadDirectory(),
});
