import {ContentCategory} from '../types';

export interface CategoryConfig {
  key: ContentCategory;
  labelAr: string;
  labelEn: string;
  icon: string;
  available: boolean;
}

export const CATEGORIES: CategoryConfig[] = [
  { key: 'movies', labelAr: 'أفلام', labelEn: 'Movies', icon: 'film', available: true },
  { key: 'anime', labelAr: 'أنمي', labelEn: 'Anime', icon: 'tv', available: true },
  { key: 'series', labelAr: 'مسلسلات', labelEn: 'Series', icon: 'play-circle', available: true },
  { key: 'tvshows', labelAr: 'برامج تلفزيونية', labelEn: 'TV Shows', icon: 'monitor', available: true },
  { key: 'asian-series', labelAr: 'مسلسلات آسيوية', labelEn: 'Asian Series', icon: 'globe', available: true },
];

export const GENRE_FILTERS = [
  'Action', 'Comedy', 'Drama', 'Thriller', 'Horror', 'Sci-Fi',
  'Romance', 'Animation', 'Documentary', 'Crime', 'Fantasy', 'Mystery',
  'Adventure', 'Biography', 'War', 'Western', 'Music', 'Sport',
];
