// HF Spaces API
export const API_BASE = 'https://ogkushhh-abdobest.hf.space';

// Metadata API endpoints (served by HF Spaces, not GitHub raw)
export const METADATA_ENDPOINTS = {
  movies: '/api/movies',
  anime: '/api/anime',
  series: '/api/series',
  tvshows: '/api/tvshows',
  'asian-series': '/api/asian-series',
  trending: '/api/trending',
  featured: '/api/featured',
  allContent: '/api/all-content',
};

// GitHub OTA Update
export const GITHUB_APP_REPO = 'OGKushhh/AbdoBest';
export const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_APP_REPO}/releases/latest`;

// Current app version
export const APP_VERSION = '1.0.0';

// Cache durations
export const METADATA_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const VIDEO_URL_TTL_MS = 6 * 60 * 60 * 1000;  // 6 hours
