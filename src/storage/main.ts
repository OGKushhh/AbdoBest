export { storage, storageKeys, getSettings, saveSettings, CATEGORY_KEYS } from './index';
export {
  setVideoUrlCache, getVideoUrlCache,
  setMetadataWithTimestamp, getMetadataIfFresh, getMetadataAnyAge,
  getCategoryTimestamp, isAnyCategoryStale, clearAllMetadataCache,
  setMetadata, getMetadata, getLastSync, setLastSync, isSyncNeeded,
} from './cache';
