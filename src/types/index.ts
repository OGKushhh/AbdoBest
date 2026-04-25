export interface ContentItem {
  id: string;
  Title: string;
  Category: string;
  'Image Source': string;
  Source: string;
  Genres: string[];
  GenresAr: string[];
  Format: string;
  Runtime: number | null;
  Country: string | null;
  'TMDb ID'?: number | null;
}

export interface TrendingItem {
  title: string;
  link: string;
  image: string;
  quality?: string;
  imdb_rating?: string;
  views?: string;
  content_type: string;
}

export interface TrendingContent {
  movies: TrendingItem[];
  episodes: TrendingItem[];
  most_viewed: TrendingItem[];
}

export interface VideoStreamInfo {
  video_url: string;
  quality_options: string[];
}

export interface DownloadItem {
  id: string;
  contentId: string;
  title: string;
  imageUrl: string;
  videoUrl: string;
  format: string;
  progress: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed';
  localPath?: string;
  totalBytes?: number;
  downloadedBytes?: number;
  timestamp: number;
}

export interface UserSettings {
  language: 'ar' | 'en';
  defaultQuality: string;
  mobileDataWarning: boolean;
  autoPlay: boolean;
  showArabicTitles: boolean;
}

export type ContentCategory = 'movies' | 'anime' | 'series' | 'tvshows' | 'asian-series';
