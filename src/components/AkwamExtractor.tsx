/**
 * AkwamExtractor – Direct version (no shortener redirects)
 *
 * WATCH mode:
 *   - WebView loads akwam.it/watch/... directly.
 *   - Injected JS scans for #player source[src] (dynamic or static).
 *   - Fallback: native fetch of the same URL after 5s as a hard guarantee.
 *
 * DOWNLOAD mode:
 *   - Pure HTTP – fetches the download page and extracts the MP4 link directly.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  AKWAM_BASE_URL,
  AKWAM_BASE_DOMAIN,
  AKWAM_REFERER,
  normalizeAkwamUrl,
} from '../constants/endpoints';

export type AkwamExtractMode = 'watch' | 'download';

interface Props {
  startUrl: string;
  mode: AkwamExtractMode;
  onExtracted: (mp4Url: string) => void;
  onError: () => void;
  timeoutMs?: number;
}

const UA =
  'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// ── Pure HTTP download resolution (no shortener) ──────────────────────────
async function resolveDownloadMp4(url: string): Promise<string> {
  // Direct fetch – no manual redirect handling, just follow them.
  const resp = await fetch(normalizeAkwamUrl(url), {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': UA,
      Referer: AKWAM_REFERER,
    },
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const html = await resp.text();

  // Patterns for the download button and fallback MP4 URLs
  const patterns = [
    /class="[^"]*\blink\b[^"]*\bbtn\b[^"]*"[^>]*href="([^"]+\.mp4[^"]*)"/i,
    /(?:href|src)="(https?:\/\/[^"]+\.mp4[^"]*)"/i,
    /https?:\/\/[^\s"'<>]+\.mp4/i,
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const mp4 = m[1] || m[0];
      // Make it absolute if relative
      if (mp4.startsWith('http')) return mp4;
      if (mp4.startsWith('/')) return `${AKWAM_BASE_URL}${mp4}`;
      return mp4;
    }
  }

  throw new Error('MP4 not found in download page');
}

// ── Extract MP4 from HTML (fallback) ──────────────────────────────────────
function extractMp4(html: string): string | null {
  const patterns = [
    /<source[^>]+src="([^"]+\.mp4[^"]*)"/i,
    /class="[^"]*\blink\b[^"]*\bbtn\b[^"]*"[^>]*href="([^"]+\.mp4[^"]*)"/i,
    /(?:href|src)="(https?:\/\/[^"]+\.mp4[^"]*)"/i,
    /https?:\/\/[^\s"'<>]+\.mp4/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1] || m[0];
  }
  return null;
}

// ── Injected JS – scans for #player source on the watch page ─────────────
const WATCH_JS = `
(function() {
  if (window.__akwamDone) return;
  window.__akwamDone = false;

  function done(url) {
    if (window.__akwamDone) return;
    window.__akwamDone = true;
    window.ReactNativeWebView.postMessage(url);
  }

  function scan() {
    var s = document.querySelector('#player source[src]');
    if (s && s.src && s.src.indexOf('.mp4') !== -1) { done(s.src); return true; }
    var tags = document.querySelectorAll('source[src], video[src]');
    for (var i = 0; i < tags.length; i++) {
      if (tags[i].src && tags[i].src.indexOf('.mp4') !== -1) { done(tags[i].src); return true; }
    }
    var m = document.documentElement.innerHTML.match(/https?:\\/\\/[^"\\'\\s<>]+\\.mp4/);
    if (m) { done(m[0]); return true; }
    return false;
  }

  if (scan()) return;
  document.addEventListener('DOMContentLoaded', scan);
  var poll = setInterval(function() {
    if (scan()) clearInterval(poll);
  }, 100);
  if (window.MutationObserver) {
    var observer = new MutationObserver(function() { if (scan()) observer.disconnect(); });
    observer.observe(document.documentElement, {childList: true, subtree: true});
  }
})();
true;
`;

// ── Component ──────────────────────────────────────────────────────────────
const AkwamExtractor: React.FC<Props> = ({
  startUrl,
  mode,
  onExtracted,
  onError,
  timeoutMs = 45000,
}) => {
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const fallbackRef = useRef<ReturnType<typeof setTimeout>>();
  const watchPageUrlRef = useRef<string | null>(null);

  const done = useCallback(
    (mp4?: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      clearTimeout(timerRef.current);
      clearTimeout(fallbackRef.current);
      mp4 ? onExtracted(mp4) : onError();
    },
    [onExtracted, onError],
  );

  const startFallback = useCallback(() => {
    const finalUrl = watchPageUrlRef.current;
    if (!finalUrl) return;
    fallbackRef.current = setTimeout(() => {
      if (doneRef.current) return;
      console.log('[Akwam] FALLBACK fetch starting:', finalUrl.substring(0, 80));
      fetch(finalUrl, { headers: { 'User-Agent': UA } })
        .then((r) => r.text())
        .then((html) => {
          const mp4 = extractMp4(html);
          if (mp4) {
            console.log('[Akwam] FALLBACK got mp4:', mp4.substring(0, 120));
            done(mp4);
          }
        })
        .catch(() => {});
    }, 5000);
  }, [done]);

  useEffect(() => {
    doneRef.current = false;
    watchPageUrlRef.current = null;
    clearTimeout(fallbackRef.current);

    timerRef.current = setTimeout(() => {
      console.warn('[AkwamExtractor] timeout');
      done();
    }, timeoutMs);

    if (mode === 'download') {
      resolveDownloadMp4(startUrl)
        .then((mp4) => {
          console.log('[Akwam] DOWNLOAD success:', mp4.substring(0, 120));
          done(mp4);
        })
        .catch((e) => {
          console.warn('[Akwam] DOWNLOAD failed:', e.message);
          done();
        });
    }

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(fallbackRef.current);
    };
  }, [startUrl, mode]);

  const handleMessage = useCallback(
    (event: any) => {
      const msg = event.nativeEvent.data;
      if (!msg) return;
      if (msg.startsWith('[AKWAM_LOG]')) {
        console.log('[Akwam]', msg.substring(11));
        return;
      }
      if (msg.includes('.mp4')) {
        console.log('[Akwam] WEBVIEW mp4:', msg.substring(0, 120));
        done(msg);
      }
    },
    [done],
  );

  const handleNavRequest = useCallback(
    (request: { url: string }) => {
      const url = request.url;
      console.log('[Akwam] WEBVIEW nav:', url?.substring(0, 120));
      if (!url) return true;
      if (url.startsWith('about:') || url.startsWith('data:')) return true;

      // Store the real watch page URL for the fallback
      const isWatchPage = url.includes(`${AKWAM_BASE_DOMAIN}/watch/`);
      if (isWatchPage && url !== watchPageUrlRef.current) {
        watchPageUrlRef.current = url;
        startFallback();
      }

      if (url.includes('.mp4')) {
        done(url);
        return false;
      }

      // Only allow akwam.it and the CDN (downet.net)
      const allowed = [AKWAM_BASE_DOMAIN, 'downet.net'];
      const ok = allowed.some((h) => url.includes(h));
      if (!ok) console.log('[Akwam] WEBVIEW blocked:', url.substring(0, 120));
      return ok;
    },
    [done, startFallback],
  );

  if (mode !== 'watch') return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
    >
      <WebView
        source={{ uri: normalizeAkwamUrl(startUrl) }}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        injectedJavaScriptBeforeContentLoaded={WATCH_JS}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleNavRequest}
        onError={() => done()}
        originWhitelist={['*']}
        {...(Platform.OS === 'android'
          ? {
              setSupportMultipleWindows: false,
              mixedContentMode: 'always' as const,
            }
          : {})}
        userAgent={UA}
      />
    </View>
  );
};

export default AkwamExtractor;