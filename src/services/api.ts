import axios from 'axios';
import {API_BASE} from '../constants/endpoints';
import {getVideoUrlCache, setVideoUrlCache} from '../storage/cache';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 120s — Playwright extraction + HF Spaces cold start
});

export const extractVideoUrl = async (pageUrl: string): Promise<{video_url: string; quality_options: string[]}> => {
  // Check local cache first (6hr TTL)
  const cached = getVideoUrlCache(pageUrl);
  if (cached) {
    return {video_url: cached.url, quality_options: cached.qualities};
  }

  try {
    // Backend uses POST /extract with JSON body {url: ...}
    const response = await api.post('/extract', {url: pageUrl});
    const data = response.data;

    if (data.stream_url || data.video_url) {
      const streamUrl = data.stream_url || data.video_url;

      // Determine quality from URL
      const qualities = streamUrl.includes('master')
        ? ['1080p', '720p', '480p', '360p']
        : ['Auto'];

      setVideoUrlCache(pageUrl, streamUrl, qualities);
      return {video_url: streamUrl, quality_options: qualities};
    }

    throw new Error(data.error || 'No video URL returned');
  } catch (error: any) {
    throw new Error(error.response?.data?.error || error.message || 'Failed to extract video');
  }
};

export const refreshVideoUrl = async (pageUrl: string) => {
  // Add cache-bust parameter to bypass server-side cache
  const bustUrl = `${pageUrl}${pageUrl.includes('?') ? '&' : '?'}_refresh=${Date.now()}`;
  return extractVideoUrl(bustUrl);
};

export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await api.get('/health');
    return response.data?.status === 'healthy';
  } catch {
    return false;
  }
};
