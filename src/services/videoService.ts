import {extractVideoUrl, refreshVideoUrl} from './api';
import {storage} from '../storage';
import {storageKeys} from '../storage';

export interface VideoServiceCallbacks {
  onProgress?: (progress: number) => void;
  onCompleted?: (localPath: string) => void;
  onError?: (error: string) => void;
}

export const getStreamUrl = async (contentId: string, sourceUrl: string) => {
  if (!sourceUrl) {
    throw new Error('No source URL available for this content');
  }
  return extractVideoUrl(sourceUrl);
};

export const getRefreshedStreamUrl = async (cacheKey: string, sourceUrl: string) => {
  return refreshVideoUrl(cacheKey, sourceUrl);
};

export const saveDownloadState = (downloads: any[]) => {
  storage.set(storageKeys.DOWNLOADS_LIST, JSON.stringify(downloads));
};

export const getDownloadState = (): any[] => {
  const raw = storage.getString(storageKeys.DOWNLOADS_LIST);
  return raw ? JSON.parse(raw) : [];
};
