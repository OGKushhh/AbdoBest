import ReactNativeBlobUtil from 'react-native-blob-util';

const CACHE_DIR = ReactNativeBlobUtil.fs.dirs.CacheDir;

export const CACHE_KEY_AUDIO = 'cached_audio';
export const CACHE_KEY_VIDEO = 'cached_video';
export const CACHE_KEY_IMAGE = 'cached_image';

interface CacheEntry {
  url: string;
  localPath: string;
  timestamp: number;
  size: number;
}

function getCacheMap(): Record<string, CacheEntry[]> {
  try {
    const map = localStorage.getItem('cacheMap');
    return map ? JSON.parse(map) : {};
  } catch {
    return {};
  }
}

async function saveCacheMap(map: Record<string, CacheEntry[]>): Promise<void> {
  try {
    localStorage.setItem('cacheMap', JSON.stringify(map));
  } catch {
    // ignore
  }
}

export async function cacheFile(
  url: string,
  type: string,
  progressCallback?: (progress: number) => void
): Promise<string> {
  const map = getCacheMap();
  const entries = map[type] || [];
  const existing = entries.find((e) => e.url === url);

  if (existing) {
    const exists = await ReactNativeBlobUtil.fs.exists(existing.localPath);
    if (exists) {
      return existing.localPath;
    }
  }

  const ext = url.split('.').pop() || 'tmp';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const localPath = `${CACHE_DIR}/${fileName}`;

  await ReactNativeBlobUtil.config({
    path: localPath,
    fileCache: true,
  }).fetch('GET', url, {});

  const newEntry: CacheEntry = {
    url,
    localPath,
    timestamp: Date.now(),
    size: 0,
  };

  try {
    const stat = await ReactNativeBlobUtil.fs.stat(localPath);
    newEntry.size = parseInt(stat.size, 10) || 0;
  } catch {
    // ignore
  }

  map[type] = [newEntry, ...entries.filter((e) => e.url !== url)];
  await saveCacheMap(map);

  return localPath;
}

export async function getCachedFile(
  url: string,
  type: string
): Promise<string | null> {
  const map = getCacheMap();
  const entries = map[type] || [];
  const existing = entries.find((e) => e.url === url);

  if (!existing) return null;

  try {
    const exists = await ReactNativeBlobUtil.fs.exists(existing.localPath);
    if (exists) {
      return existing.localPath;
    }
  } catch {
    // ignore
  }

  return null;
}

export async function clearCache(type?: string): Promise<void> {
  const map = getCacheMap();

  if (type) {
    const entries = map[type] || [];
    for (const entry of entries) {
      try {
        const exists = await ReactNativeBlobUtil.fs.exists(entry.localPath);
        if (exists) {
          await ReactNativeBlobUtil.fs.unlink(entry.localPath);
        }
      } catch {
        // ignore
      }
    }
    map[type] = [];
  } else {
    for (const key of Object.keys(map)) {
      for (const entry of map[key]) {
        try {
          const exists = await ReactNativeBlobUtil.fs.exists(entry.localPath);
          if (exists) {
            await ReactNativeBlobUtil.fs.unlink(entry.localPath);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  await saveCacheMap(map);
}

export async function getCacheSize(): Promise<number> {
  const map = getCacheMap();
  let totalSize = 0;

  for (const key of Object.keys(map)) {
    for (const entry of map[key]) {
      totalSize += entry.size || 0;
    }
  }

  return totalSize;
}
