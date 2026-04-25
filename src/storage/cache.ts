import {storage, storageKeys} from './index';

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export const setVideoUrlCache = (key: string, url: string, qualities: string[]) => {
  const entry = {
    url,
    qualities,
    timestamp: Date.now(),
  };
  storage.set(storageKeys.VIDEO_URL_CACHE + key, JSON.stringify(entry));
};

export const getVideoUrlCache = (key: string): {url: string; qualities: string[]} | null => {
  const raw = storage.getString(storageKeys.VIDEO_URL_CACHE + key);
  if (!raw) return null;
  const entry = JSON.parse(raw);
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    storage.delete(storageKeys.VIDEO_URL_CACHE + key);
    return null;
  }
  return {url: entry.url, qualities: entry.qualities};
};

export const setMetadata = (key: string, data: any) => {
  storage.set(key, JSON.stringify(data));
};

export const getMetadata = (key: string): any | null => {
  const raw = storage.getString(key);
  return raw ? JSON.parse(raw) : null;
};

export const getLastSync = (): number => {
  return storage.getNumber(storageKeys.METADATA_LAST_SYNC) || 0;
};

export const setLastSync = () => {
  storage.set(storageKeys.METADATA_LAST_SYNC, Date.now());
};

export const isSyncNeeded = (): boolean => {
  const lastSync = getLastSync();
  return Date.now() - lastSync > 24 * 60 * 60 * 1000; // 24 hours
};
