import axios from 'axios';
import {METADATA_URLS} from '../constants/endpoints';
import {getMetadata, setMetadata, setLastSync, isSyncNeeded, getLastSync} from '../storage/cache';
import {storageKeys} from '../storage';
import {ContentItem, TrendingContent} from '../types';

const http = axios.create({timeout: 30000});

type ContentDict = Record<string, ContentItem>;

export const loadMovies = async (forceRefresh = false): Promise<ContentDict> => {
  if (!forceRefresh) {
    const cached = getMetadata(storageKeys.METADATA_MOVIES);
    if (cached) return cached;
  }
  try {
    const response = await http.get(METADATA_URLS.movies);
    const data: ContentDict = response.data;
    Object.keys(data).forEach(id => {
      data[id].id = id;
    });
    setMetadata(storageKeys.METADATA_MOVIES, data);
    setLastSync();
    return data;
  } catch (error) {
    const cached = getMetadata(storageKeys.METADATA_MOVIES);
    if (cached) return cached;
    throw error;
  }
};

export const loadTrending = async (forceRefresh = false): Promise<TrendingContent | null> => {
  if (!forceRefresh) {
    const cached = getMetadata(storageKeys.METADATA_TRENDING);
    if (cached) return cached;
  }
  try {
    const response = await http.get(METADATA_URLS.trending);
    const data: TrendingContent = response.data;
    setMetadata(storageKeys.METADATA_TRENDING, data);
    return data;
  } catch (error) {
    const cached = getMetadata(storageKeys.METADATA_TRENDING);
    if (cached) return cached;
    return null;
  }
};

export const searchContent = (movies: ContentDict, query: string): ContentItem[] => {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];
  
  return Object.values(movies).filter(item => {
    const titleMatch = item.Title?.toLowerCase().includes(lowerQuery);
    const genreMatch = item.Genres?.some(g => g.toLowerCase().includes(lowerQuery));
    const genreArMatch = item.GenresAr?.some(g => g.toLowerCase().includes(lowerQuery));
    const countryMatch = item.Country?.toLowerCase().includes(lowerQuery);
    const formatMatch = item.Format?.toLowerCase().includes(lowerQuery);
    return titleMatch || genreMatch || genreArMatch || countryMatch || formatMatch;
  });
};

export const filterByGenre = (movies: ContentDict, genre: string): ContentItem[] => {
  return Object.values(movies).filter(item => {
    return item.Genres?.includes(genre) || item.GenresAr?.includes(genre);
  });
};

export const getMoviesArray = (movies: ContentDict): ContentItem[] => {
  return Object.values(movies);
};

export const syncIfNeeded = async (): Promise<boolean> => {
  if (!isSyncNeeded()) return false;
  try {
    await Promise.all([loadMovies(true), loadTrending(true)]);
    return true;
  } catch {
    return false;
  }
};

export const getLastSyncTime = (): number => getLastSync();
