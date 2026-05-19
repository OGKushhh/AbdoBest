/**
 * downloadService.ts
 *
 * @kesha-antonov/react-native-background-downloader v3.2.6 — verified API:
 *
 *   import { download, completeHandler, directories, checkForExistingDownloads } from '...'
 *
 *   download({ id, url, destination, headers?, metadata? })
 *     .begin(({ expectedBytes, headers }) => {})   ← note: expectedBytes not bytesTotal
 *     .progress(({ bytesDownloaded, bytesTotal }) => {})
 *     .done(({ bytesDownloaded, bytesTotal }) => {})
 *     .error(({ error, errorCode }) => {})
 *
 *   directories.documents  — documents path
 *   checkForExistingDownloads() — returns Promise<DownloadTask[]>
 *   completeHandler(id)    — required on iOS after done
 *
 *   task.pause() / task.resume() / task.stop() — synchronous, no await
 */

import {
  download,
  completeHandler,
  directories,
  checkForExistingDownloads,
  setConfig,
} from '@kesha-antonov/react-native-background-downloader';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {Linking, Platform} from 'react-native';
import {DownloadItem, ContentItem} from '../types';
import {storage, storageKeys, getSettings} from '../storage';
import {AKWAM_BASE_URL, AKWAM_REFERER} from '../constants/endpoints';

// Enable native download logs so we can see exactly what's happening
setConfig({ isLogsEnabled: true, progressInterval: 1000 });

// Platform-aware User-Agent — some servers fingerprint the UA and reject mismatched platforms
const DOWNLOAD_UA = Platform.OS === 'ios'
  ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  : 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// ─── Task type ────────────────────────────────────────────────────────────
type AnyTask = ReturnType<typeof download>;

// ─── In-memory task registry ──────────────────────────────────────────────
const activeTasks = new Map<string, any>(); // background-downloader tasks (restore only)
const blobTasks   = new Map<string, any>(); // blob-util StatefulPromise tasks

// ─── Change listeners ─────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();

export const subscribeDownloads = (fn: Listener) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const notify = () => listeners.forEach(fn => fn());

// ─── Persistence ──────────────────────────────────────────────────────────
export const getDownloadState = (): DownloadItem[] => {
  try {
    const raw = storage.getString(storageKeys.DOWNLOADS_LIST);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveDownloadState = (items: DownloadItem[]) => {
  storage.set(storageKeys.DOWNLOADS_LIST, JSON.stringify(items));
};

const updateItem = (id: string, patch: Partial<DownloadItem>) => {
  const items = getDownloadState();
  const idx = items.findIndex(d => d.id === id);
  if (idx === -1) return;
  items[idx] = {...items[idx], ...patch};
  saveDownloadState(items);
  notify();
};

// ─── Destination path ─────────────────────────────────────────────────────
const getDestPath = (id: string) =>
  `${directories.documents}/downloads/${id}.mp4`;

// ─── Attach handlers to a task ────────────────────────────────────────────
const attachHandlers = (task: AnyTask, id: string) => {
  task
    .begin(({expectedBytes}: {expectedBytes: number}) => {
      // 'expectedBytes' is the correct param name from the native begin event
      updateItem(id, {totalBytes: expectedBytes, status: 'downloading'});
    })
    .progress(({bytesDownloaded, bytesTotal}: {bytesDownloaded: number; bytesTotal: number}) => {
      const progress = bytesTotal > 0 ? bytesDownloaded / bytesTotal : 0;
      updateItem(id, {
        progress,
        downloadedBytes: bytesDownloaded,
        totalBytes: bytesTotal,
        status: 'downloading',
      });
    })
    .done(({bytesDownloaded, bytesTotal}: {bytesDownloaded: number; bytesTotal: number}) => {
      const destPath = getDestPath(id);
      updateItem(id, {
        status: 'completed',
        progress: 1,
        downloadedBytes: bytesDownloaded,
        totalBytes: bytesTotal,
        localPath: `file://${destPath}`,
        destinationPath: destPath,
      });
      activeTasks.delete(id);
      completeHandler(id); // required on iOS
    })
    .error(({error, errorCode}: {error: string; errorCode: number}) => {
      console.warn('[Download] task error:', error, errorCode);
      updateItem(id, {status: 'failed', errorMessage: String(error)});
      activeTasks.delete(id);
    });
};

// ─── Restore interrupted downloads on app start ───────────────────────────
export const restoreDownloads = async () => {
  try {
    const lostTasks = await checkForExistingDownloads();
    const items = getDownloadState();
    for (const task of lostTasks) {
      const item = items.find(d => d.id === task.id);
      if (!item || item.status === 'completed') {
        task.stop();
        continue;
      }
      attachHandlers(task, item.id);
      activeTasks.set(item.id, task);
      updateItem(item.id, {status: 'downloading'});
    }
  } catch (e) {
    console.warn('[Download] restoreDownloads error:', e);
  }
};

// ─── Start a new download (Akwam MP4 — blob-util) ─────────────────────────
export const startDownload = async (
  item: ContentItem,
  mp4Url: string,
  quality = 'auto',
  seriesId?: string,
  seriesTitle?: string,
): Promise<DownloadItem> => {
  // Read user's preferred save location from settings
  // DownloadDir is Android-only; fall back to DocumentDir on iOS
  const { downloadDir: dirPref } = getSettings();
  const baseDir = Platform.OS === 'ios'
    ? ReactNativeBlobUtil.fs.dirs.DocumentDir
    : dirPref === 'internal'
      ? ReactNativeBlobUtil.fs.dirs.DocumentDir
      : ReactNativeBlobUtil.fs.dirs.DownloadDir;
  const dir = `${baseDir}/AbdoApp`;
  const dirExists = await ReactNativeBlobUtil.fs.isDir(dir);
  if (!dirExists) await ReactNativeBlobUtil.fs.mkdir(dir);

  const id = `dl_${item.id}_${Date.now()}`;
  const safeName = (item.Title || 'video').replace(/[^\w\u0600-\u06FF\s.-]/g, '').trim().substring(0, 60);
  const destPath = `${dir}/${safeName}_${id}.mp4`;

  const downloadItem: DownloadItem = {
    id,
    contentId: item.id,
    title: item.Title,
    imageUrl: item['Image Source'] || (item as any).Image || (item as any).poster || '',
    videoUrl: mp4Url,
    format: item.Format || '',
    quality,
    progress: 0,
    status: 'downloading',
    timestamp: Date.now(),
    destinationPath: destPath,
    seriesId,
    seriesTitle,
  };

  const current = getDownloadState();
  saveDownloadState([downloadItem, ...current]);
  notify();

  const task = ReactNativeBlobUtil.config({
    path: destPath,
    fileCache: true,
    overwrite: true,
    indicator: true,
    trusty: true, // fixes SSL CertPathValidatorException on older Android/MIUI
  }).fetch('GET', mp4Url, {
    'User-Agent': DOWNLOAD_UA,
    'Referer': AKWAM_REFERER,
    'Origin': AKWAM_BASE_URL,
  });

  task.progress({ interval: 500 }, (received: number, total: number) => {
    const progress = total > 0 ? received / total : 0;
    updateItem(id, { progress, downloadedBytes: received, totalBytes: total, status: 'downloading' });
  });

  blobTasks.set(id, task);

  task
    .then((res: any) => {
      console.log('[Download] done:', id, res.path());
      updateItem(id, { status: 'completed', progress: 1, localPath: `file://${destPath}`, destinationPath: destPath });
      blobTasks.delete(id);
    })
    .catch((e: any) => {
      if (e?.message === 'cancelled') {
        updateItem(id, {status: 'paused'});
      } else {
        console.warn('[Download] error:', e);
        updateItem(id, {status: 'failed', errorMessage: String(e?.message || e)});
      }
      blobTasks.delete(id);
    });

  return downloadItem;
};

// ─── Register a Fasel HLS download (metadata only) ───────────────────────
//
// Saves the item to MMKV with status:'external' so it appears in
// DownloadsScreen with poster + title. The actual intent launch is handled
// by HlsAppChooserModal — this function only manages local state.
//
export const registerFaselDownload = (
  item: ContentItem,
  m3u8Url: string,
  quality = 'auto',
  externalApp = Platform.OS === 'ios' ? 'Outplayer' : '1DM',
  seriesId?: string,
  seriesTitle?: string,
): DownloadItem => {
  const id = `fasel_${item.id}_${Date.now()}`;

  const downloadItem: DownloadItem = {
    id,
    contentId: item.id,
    title: seriesTitle ? `${seriesTitle} - ${item.Title}` : item.Title,
    imageUrl: item['Image Source'] || (item as any).Image || (item as any).poster || '',
    videoUrl: m3u8Url,
    format: 'HLS',
    quality,
    progress: 1,         // indeterminate — external app owns progress
    status: 'external',
    timestamp: Date.now(),
    destinationPath: '', // unknown — external app decides
    externalApp,
    seriesId,
    seriesTitle,
  };

  const current = getDownloadState();
  saveDownloadState([downloadItem, ...current]);
  notify();

  return downloadItem;
};

// ─── Open external downloader app (for "Open in …" button in DownloadsScreen)
export const openHlsApp = async (appName = 'Outplayer', m3u8Url?: string) => {
  if (Platform.OS === 'ios') {
    // Try to open the app directly with the URL if we have it
    if (m3u8Url) {
      const iosSchemeMap: Record<string, (url: string) => string> = {
        'Outplayer': (url) => `outplayer://${url}`,
        'Documents':  (url) => `rdocs://${url}`,
      };
      const makeScheme = iosSchemeMap[appName] ?? iosSchemeMap['Outplayer'];
      const deepLink = makeScheme(m3u8Url);
      const canOpen = await Linking.canOpenURL(deepLink).catch(() => false);
      if (canOpen) {
        await Linking.openURL(deepLink).catch(() => {});
        return;
      }
    }
    // App not installed — send to App Store
    const iosStoreMap: Record<string, string> = {
      'Outplayer': 'https://apps.apple.com/app/outplayer/id1449697545',
      'Documents':  'https://apps.apple.com/app/documents-file-manager-browser/id364901807',
    };
    await Linking.openURL(iosStoreMap[appName] ?? iosStoreMap['Outplayer']).catch(() => {});
    return;
  }
  // Android: intent URI to launch the app directly, fall back to Play Store
  const pkgMap: Record<string, string> = {
    '1DM': 'idm.internet.download.manager',
    'ADM': 'com.dv.adm',
  };
  const pkg = pkgMap[appName] ?? pkgMap['1DM'];
  try {
    await Linking.openURL(`intent://#Intent;package=${pkg};end`);
  } catch {
    try {
      await Linking.openURL(`market://details?id=${pkg}`);
    } catch {
      await Linking.openURL(`https://play.google.com/store/apps/details?id=${pkg}`);
    }
  }
};

// ─── Pause ────────────────────────────────────────────────────────────────
export const pauseDownload = (id: string) => {
  const task = blobTasks.get(id);
  if (task) {
    task.cancel(); // blob-util: cancel fires .catch with 'cancelled'
    updateItem(id, {status: 'paused'});
  }
};

// ─── Resume — continues from where the download was paused ───────────────
// blob-util has no native resume, but most CDNs support HTTP Range requests.
// We check how many bytes were already downloaded and send Range: bytes=N-
// so the server starts from that offset. The received bytes are appended to
// the existing partial file.
export const resumeDownload = async (id: string) => {
  const items = getDownloadState();
  const item = items.find(d => d.id === id);
  if (!item || item.status !== 'paused') return;

  const destPath = item.destinationPath;
  let startByte = 0;

  // Find out how many bytes we already have on disk
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(destPath);
    if (exists) {
      const stat = await ReactNativeBlobUtil.fs.stat(destPath);
      startByte = parseInt(stat.size, 10) || 0;
    }
  } catch {
    startByte = 0;
  }

  updateItem(id, {status: 'downloading', errorMessage: undefined});

  const headers: Record<string, string> = {
    'User-Agent': DOWNLOAD_UA,
    'Referer': AKWAM_REFERER,
    'Origin': AKWAM_BASE_URL,
  };
  if (startByte > 0) {
    headers['Range'] = `bytes=${startByte}-`;
  }

  const task = ReactNativeBlobUtil.config({
    path: destPath,
    fileCache: true,
    // overwrite only if we're starting fresh; otherwise append
    overwrite: startByte === 0,
    indicator: true,
  }).fetch('GET', item.videoUrl, headers);

  task.progress({ interval: 500 }, (received: number, total: number) => {
    const totalWithOffset = total + startByte;
    const receivedWithOffset = received + startByte;
    const progress = totalWithOffset > 0 ? receivedWithOffset / totalWithOffset : 0;
    updateItem(id, {
      progress,
      downloadedBytes: receivedWithOffset,
      totalBytes: totalWithOffset,
      status: 'downloading',
    });
  });

  blobTasks.set(id, task);

  task
    .then((res: any) => {
      console.log('[Download] resume done:', id, res.path());
      updateItem(id, {status: 'completed', progress: 1, localPath: `file://${destPath}`, destinationPath: destPath});
      blobTasks.delete(id);
    })
    .catch((e: any) => {
      if (e?.message === 'cancelled') {
        updateItem(id, {status: 'paused'});
      } else {
        console.warn('[Download] resume error:', e);
        updateItem(id, {status: 'failed', errorMessage: String(e?.message || e)});
      }
      blobTasks.delete(id);
    });
};

// ─── Cancel + delete ──────────────────────────────────────────────────────
export const deleteDownload = async (id: string) => {
  const blobTask = blobTasks.get(id);
  if (blobTask) { blobTask.cancel(); blobTasks.delete(id); }
  const bgTask = activeTasks.get(id);
  if (bgTask) { bgTask.stop(); activeTasks.delete(id); }

  // Use item.destinationPath (where blob-util actually saved the file) rather
  // than getDestPath(id) which points to the background-downloader location.
  const item = getDownloadState().find(d => d.id === id);
  const pathsToDelete = new Set<string>();
  if (item?.destinationPath) pathsToDelete.add(item.destinationPath);
  pathsToDelete.add(getDestPath(id)); // also clean up bg-downloader path if present

  for (const p of pathsToDelete) {
    try {
      const exists = await ReactNativeBlobUtil.fs.exists(p);
      if (exists) await ReactNativeBlobUtil.fs.unlink(p);
    } catch (e) {
      console.warn('[Download] delete file error:', e);
    }
  }

  const items = getDownloadState().filter(d => d.id !== id);
  saveDownloadState(items);
  notify();
};

// ─── Retry a failed download ──────────────────────────────────────────────
export const retryDownload = async (id: string) => {
  const items = getDownloadState();
  const item = items.find(d => d.id === id);
  if (!item || (item.status !== 'failed' && item.status !== 'paused' && item.status !== 'pending')) return;

  const destPath = item.destinationPath;
  updateItem(id, {status: 'downloading', progress: 0, errorMessage: undefined});

  const task = ReactNativeBlobUtil.config({
    path: destPath,
    fileCache: true,
    overwrite: true,
    indicator: true,
  }).fetch('GET', item.videoUrl, {
    'User-Agent': DOWNLOAD_UA,
    'Referer': AKWAM_REFERER,
    'Origin': AKWAM_BASE_URL,
  });

  task.progress({ interval: 500 }, (received: number, total: number) => {
    const progress = total > 0 ? received / total : 0;
    updateItem(id, { progress, downloadedBytes: received, totalBytes: total, status: 'downloading' });
  });

  blobTasks.set(id, task);

  task
    .then((res: any) => {
      console.log('[Download] retry done:', id, res.path());
      updateItem(id, { status: 'completed', progress: 1, localPath: `file://${destPath}`, destinationPath: destPath });
      blobTasks.delete(id);
    })
    .catch((e: any) => {
      if (e?.message === 'cancelled') {
        updateItem(id, { status: 'paused' });
      } else {
        console.warn('[Download] retry error:', e);
        updateItem(id, { status: 'failed', errorMessage: String(e?.message || e) });
      }
      blobTasks.delete(id);
    });
};
