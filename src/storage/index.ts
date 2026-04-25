import {MMKV} from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'abdobest-storage',
  encryptionKey: 'abdobest-secure-key-2024',
});

export const storageKeys = {
  LANGUAGE: 'user_language',
  THEME: 'user_theme',
  METADATA_MOVIES: 'metadata_movies',
  METADATA_TRENDING: 'metadata_trending',
  METADATA_LAST_SYNC: 'metadata_last_sync',
  VIDEO_URL_CACHE: 'video_url_cache_',
  DOWNLOADS_LIST: 'downloads_list',
  SETTINGS: 'user_settings',
};

export const getSettings = (): any => {
  const raw = storage.getString(storageKeys.SETTINGS);
  return raw ? JSON.parse(raw) : {
    language: 'ar',
    defaultQuality: '1080p',
    mobileDataWarning: true,
    autoPlay: false,
    showArabicTitles: true,
  };
};

export const saveSettings = (settings: any) => {
  storage.set(storageKeys.SETTINGS, JSON.stringify(settings));
};
