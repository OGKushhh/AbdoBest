import axios from 'axios';
import * as cheerio from 'cheerio-without-native';

const BASE_URL = 'https://www.fasel-hd.cam';
let globalCookies = '';

export const setCookies = (cookieString) => { globalCookies = cookieString; };

const getHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)...',
  'Cookie': globalCookies,
  'Referer': BASE_URL
});

const fetchHTML = async (path) => {
  try {
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const response = await axios.get(url, { headers: getHeaders(), timeout: 10000 });
    return response.data;
  } catch (e) { console.error(e); return null; }
};

export const scrapeHome = async () => {
  const html = await fetchHTML('/main');
  if (!html) return { movies: [], episodes: [] };
  const $ = cheerio.load(html);
  const movies = [], episodes = [];

  // Parse Movies
  $('.blockMovie').each((i, el) => {
    const $el = $(el);
    const link = $el.find('> a').first().attr('href');
    const title = $el.find('.h5').text().trim();
    const img = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src');
    if (link && title) movies.push({ id: link, title, poster: img, type: 'movie' });
  });

  // Parse Episodes
  $('.epDivHome').each((i, el) => {
    const $el = $(el);
    const link = $el.find('> a').first().attr('href');
    const title = $el.find('.h4').text().trim();
    const img = $el.find('.epHomeImg img').first().attr('data-src') || $el.find('.epHomeImg img').first().attr('src');
    if (link && title) episodes.push({ id: link, title, poster: img, type: 'series' });
  });

  return { movies, episodes };
};

export const search = async (query) => {
  const html = await fetchHTML(`/main?s=${encodeURIComponent(query)}`);
  if (!html) return [];
  const $ = cheerio.load(html);
  const results = [];
  $('.blockMovie').each((i, el) => {
    const $el = $(el);
    const link = $el.find('> a').first().attr('href');
    const title = $el.find('.h5').text().trim();
    const img = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src');
    if (link && title) results.push({ id: link, title, poster: img, type: 'movie' });
  });
  return results;
};

export const getDetails = async (url) => {
  const html = await fetchHTML(url);
  if (!html) return null;
  const $ = cheerio.load(html);
  
  const title = $('h1').text().trim();
  const poster = $('.poster-img img').attr('src') || '';
  const desc = $('.story, .overview').text().trim();
  
  const sources = [];
  
  // 1. Find Direct Video Links (For react-native-video)
  const directSources = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && (href.endsWith('.mp4') || href.endsWith('.m3u8') || href.includes('dl=1'))) {
      directSources.push({
        url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
        label: text || 'Direct Link',
        type: 'direct'
      });
    }
  });

  // 2. Find Iframe Links (Fallback for WebView)
  const iframeSources = [];
  $('.server-list a, iframe').each((i, el) => {
    const src = $(el).attr('data-link') || $(el).attr('src');
    if (src && !src.endsWith('.mp4')) {
      iframeSources.push({
        url: src.startsWith('http') ? src : `${BASE_URL}${src}`,
        label: `Server ${i + 1}`,
        type: 'iframe'
      });
    }
  });

  return { title, poster, desc, sources: [...directSources, ...iframeSources] };
};
