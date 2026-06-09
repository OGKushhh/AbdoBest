/**
 * VideoExtractor.tsx  v9
 *
 * Fixes vs v6 (original):
 *  1. domStorageEnabled={true}        — JWPlayer requires localStorage to init.
 *  2. thirdPartyCookiesEnabled={true} — player_token page sets session cookies.
 *  3. cacheEnabled left as default (true) — lets JWPlayer JS bundle cache.
 *  4. muted removed (defaults false)  — some JWPlayer builds won't fire stream if muted.
 *  5. Broader CDN allowlist           — cloudfront.net, akamaized.net, fastly.net etc.
 *  6. PATCH_JS intercepts video.src   — JWPlayer sometimes sets src directly.
 *  7. Removed cacheMode="LOAD_NO_CACHE".
 *
 * v8 changes:
 *  8. Added xrnrhowppgvxdhm.com, warehouses2120.net to BLOCKED_DOMAINS.
 *  9. killOverlays() in PATCH_JS — removes full-screen click-stealing ad overlays.
 */

import React, {useRef, useEffect, useCallback} from 'react';
import {View, Dimensions, Platform} from 'react-native';
import {WebView} from 'react-native-webview';

const {width: SW, height: SH} = Dimensions.get('window');

// ── JS injected BEFORE any page scripts ─────────────────────────────────────
const PATCH_JS = `
(function() {
  try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'PATCH: injected on ' + window.location.href.substring(0,80)})); } catch(e) {}

  var _post = function(url) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'m3u8', url: url})); } catch(e) {}
  };

  // Override fetch
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url ? input.url : String(input));
      if (url && url.indexOf('.m3u8') !== -1) _post(url);
    } catch(e) {}
    return origFetch.apply(this, arguments);
  };

  // Override XHR
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try { if (url && url.indexOf('.m3u8') !== -1) _post(url); } catch(e) {}
    return origOpen.apply(this, arguments);
  };

  // Override HTMLMediaElement.src (JWPlayer sometimes sets it directly)
  try {
    var desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (desc && desc.set) {
      var origSet = desc.set;
      Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        set: function(val) {
          try { if (val && val.indexOf('.m3u8') !== -1) _post(val); } catch(e) {}
          return origSet.call(this, val);
        },
        get: desc.get,
        configurable: true,
      });
    }
  } catch(e) {}

  // Patch iframes as they are added
  var obs = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.tagName !== 'IFRAME') return;
        try {
          var win = node.contentWindow;
          if (!win) return;
          if (win.fetch) {
            var iF = win.fetch;
            win.fetch = function(input, init) {
              try { var u = typeof input === 'string' ? input : (input && input.url ? input.url : ''); if (u && u.indexOf('.m3u8') !== -1) _post(u); } catch(e) {}
              return iF.apply(this, arguments);
            };
          }
          if (win.XMLHttpRequest) {
            var iX = win.XMLHttpRequest.prototype.open;
            win.XMLHttpRequest.prototype.open = function(method, url) {
              try { if (url && url.indexOf('.m3u8') !== -1) _post(url); } catch(e) {}
              return iX.apply(this, arguments);
            };
          }
        } catch(e) {}
      });
    });
  });
  try { obs.observe(document.documentElement || document.body, {childList: true, subtree: true}); } catch(e) {}

  // Suppress new tabs / popups
  window.open    = function() { return null; };
  window.alert   = function() {};
  window.confirm = function() { return false; };
  window.prompt  = function() { return null; };

  // Kill click-stealing overlays: any fixed/absolute full-screen div that isn't
  // part of JWPlayer gets pointer-events removed so clicks reach JWPlayer.
  function killOverlays() {
    try {
      var all = document.querySelectorAll('div, a, span');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        var cls = (el.className && typeof el.className === 'string') ? el.className : '';
        var id  = el.id || '';
        if (cls.indexOf('jw') !== -1 || id.indexOf('jw') !== -1) continue;
        var st = window.getComputedStyle(el);
        if ((st.position === 'fixed' || st.position === 'absolute') &&
            parseInt(st.width)  > window.innerWidth  * 0.8 &&
            parseInt(st.height) > window.innerHeight * 0.8 &&
            parseInt(st.zIndex) > 0) {
          el.style.pointerEvents = 'none';
          el.style.display = 'none';
        }
      }
    } catch(e) {}
  }
  setInterval(killOverlays, 1000);

  try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'PATCH: all overrides installed'})); } catch(e) {}
})();
true;
`;

// ── JS injected AFTER DOM ready ──────────────────────────────────────────────
const CLICK_JS = `
(function() {
  try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'DOC-END: ' + window.location.href.substring(0,100)})); } catch(e) {}

  // ── Report all server token URLs from tabs-ul immediately ─────────────────
  try {
    var serverTabs = document.querySelectorAll('.tabs-ul li');
    if (serverTabs.length > 0) {
      var tokens = [];
      serverTabs.forEach(function(li) {
        var oc = li.getAttribute('onclick') || '';
        var m = oc.match(/player_iframe\.location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (m && m[1]) tokens.push(m[1]);
      });
      if (tokens.length > 0) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'server_tokens', urls: tokens})); } catch(e) {}
      }
    }
  } catch(e) {}

  // Stay on movie page — scroll player_iframe into view so JWPlayer lazy-loads,
  // then click .jw-icon-display inside the iframe's contentDocument directly.
  // No top-level navigation needed (same origin, PATCH_JS MutationObserver already
  // patched the iframe's fetch/XHR when it was added to the DOM).

  var playerIframe = document.querySelector('iframe[name="player_iframe"]');
  if (!playerIframe) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'NO player_iframe found'})); } catch(e) {}
    return;
  }

  // Scroll iframe into view to trigger lazy load
  try { playerIframe.scrollIntoView({behavior: 'instant', block: 'center'}); } catch(e) {}
  try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'SCROLLED: player_iframe into view'})); } catch(e) {}

  var attempts = 0;
  var PLAY_SEL = [
    '.jw-icon-display',
    '.jw-icon.jw-icon-display',
    '.jw-display-icon-container',
    '[class*="jw-icon"][class*="play"]',
    '.jw-media video',
    'video',
  ];

  var iv = setInterval(function() {
    attempts++;

    try {
      var doc = playerIframe.contentDocument || (playerIframe.contentWindow && playerIframe.contentWindow.document);
      if (!doc) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'ATTEMPT ' + attempts + ': no contentDocument yet'})); } catch(e) {}
        if (attempts >= 15) { clearInterval(iv); try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'DONE: gave up waiting for contentDocument'})); } catch(e) {} }
        return;
      }

      var jwCount = doc.querySelectorAll('[class*="jw"]').length;
      var vidCount = doc.querySelectorAll('video').length;

      var clicked = false;
      for (var i = 0; i < PLAY_SEL.length; i++) {
        var el = doc.querySelector(PLAY_SEL[i]);
        if (el) {
          try { el.click(); } catch(e) {}
          clicked = true;
          try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'CLICK #' + attempts + ' on: ' + PLAY_SEL[i] + ' | jw=' + jwCount + ' vid=' + vidCount})); } catch(e) {}
          break;
        }
      }

      if (!clicked) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'ATTEMPT ' + attempts + ': no play btn | jw=' + jwCount + ' | video=' + vidCount})); } catch(e) {}
      }
    } catch(ex) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'ATTEMPT ' + attempts + ': exception: ' + String(ex).substring(0,60)})); } catch(e) {}
    }

    if (attempts >= 15) {
      clearInterval(iv);
      try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', msg:'DONE: 15 attempts exhausted'})); } catch(e) {}
    }
  }, 2000);
})();
true;
`;

// ── Blocked ad/tracker domains ───────────────────────────────────────────────
const BLOCKED_DOMAINS = [
  's8ey.com', 'wplmtckt.com', 'reffpa.com', '1xlite-11151.pro', 'pyppo.com',
  'googletagmanager.com', 'doubleclick.net', 'googleadservices.com',
  'google-analytics.com', 'popads.net', 'adsterra.com', 'exponential.com',
  'outbrain.com', 'taboola.com', 'scorecardresearch.com', 'madurird.com',
  'acscdn.com', 'crumpetprankerstench.com', 'propellerads.com',
  'clickadu.com', 'adnxs.com', 'ads.yahoo.com',
  'notix.io', 'pushwoosh.com', 'onesignal.com',
  'tmll7.com', '1xlite-24510.bar', 'mahjong778jpx.site',
  'browsecoherentunrefined.com', 'kettledroopingcontinuation.com',
  'zoologyfibre.com',
  'gukahdbam.com',
  'govrrobif.com',
  '6402functions.net',
  'effectivecpmnetwork.com',
  'xrnrhowppgvxdhm.com',
  'warehouses2120.net',
];

// ── Allowed domains ──────────────────────────────────────────────────────────
const ALLOWED_DOMAINS = [
  'fasel-hd.cam',
  'faselhd.com',
  'faselhd.tv',
  'faselhdx.bid',
  'faselhdx.com',
  'scdns.io',
  'jwpcdn.com',
  'jwplayer.com',
  'cdn.jwplayer.com',
  'content.jwplatform.com',
  'ssl.p.jwpcdn.com',
  'cloudfront.net',
  'akamaized.net',
  'akamai.net',
  'fastly.net',
  'llnwd.net',
  'edgesuite.net',
];

interface VideoExtractorProps {
  pageUrl: string;
  onExtracted: (m3u8Urls: string[]) => void;
  onError: (reason?: 'timeout' | 'load' | 'http') => void;
  onDebug?: (msg: string) => void;
  timeoutMs?: number;
  collectWindowMs?: number;
  collectAllServers?: boolean;
  onServerTokens?: (urls: string[]) => void;
}

export const VideoExtractor: React.FC<VideoExtractorProps> = ({
  pageUrl,
  onExtracted,
  onError,
  onDebug,
  timeoutMs = 45000,
  collectWindowMs = 4000,
  collectAllServers = false,
  onServerTokens,
}) => {
  const captured      = useRef(false);
  const collected     = useRef<string[]>([]);
  const collectTimer  = useRef<ReturnType<typeof setTimeout>>();
  const globalTimer   = useRef<ReturnType<typeof setTimeout>>();

  const dbg = useCallback((msg: string) => {
    console.log('[VE]', msg);
    onDebug?.(msg);
  }, [onDebug]);

  const isMasterPlaylist = (url: string) =>
    url.includes('master.m3u8') || url.includes('/master') || !url.match(/\/(sd|hd|[0-9]+p?)[/_]/i);

  const commit = useCallback(() => {
    if (captured.current) return;
    captured.current = true;
    clearTimeout(collectTimer.current);
    clearTimeout(globalTimer.current);
    const urls = collected.current;
    if (urls.length === 0) {
      dbg('COMMIT: no URLs — firing timeout');
      onError('timeout');
      return;
    }
    dbg('COMMIT: ' + urls.length + ' URL(s): ' + urls.map(u => u.substring(0, 60)).join(' | '));
    onExtracted(urls);
  }, [onExtracted, onError, dbg]);

  const addUrl = useCallback((url: string) => {
    if (!isMasterPlaylist(url)) {
      dbg('SKIP child playlist: ' + url.substring(0, 80));
      return;
    }
    if (collected.current.includes(url)) return;
    collected.current = [...collected.current, url];
    dbg('COLLECTED #' + collected.current.length + ': ' + url.substring(0, 80));

    if (!collectAllServers) {
      commit();
      return;
    }

    clearTimeout(collectTimer.current);
    collectTimer.current = setTimeout(commit, collectWindowMs);
  }, [commit, collectWindowMs, dbg]);

  useEffect(() => {
    captured.current  = false;
    collected.current = [];
    clearTimeout(collectTimer.current);
    clearTimeout(globalTimer.current);
    dbg('START: ' + pageUrl);
    globalTimer.current = setTimeout(() => {
      if (collected.current.length > 0) {
        commit();
      } else {
        captured.current = true;
        dbg('TIMEOUT after ' + timeoutMs + 'ms');
        onError('timeout');
      }
    }, timeoutMs);
    return () => {
      clearTimeout(collectTimer.current);
      clearTimeout(globalTimer.current);
    };
  }, [pageUrl]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'm3u8' && data.url && !captured.current) {
        addUrl(data.url);
        return;
      }
      if (data.type === 'server_tokens' && data.urls?.length) {
        dbg('SERVER_TOKENS: ' + data.urls.length + ' token URLs');
        onServerTokens?.(data.urls);
        return;
      }
      if (data.type === 'debug') dbg(data.msg);
    } catch (e) {}
  }, [addUrl, dbg, onServerTokens]);

  const handleShouldStartLoad = useCallback((request: {url: string}) => {
    const url = request.url;

    if (url.includes('.m3u8') && !captured.current) {
      addUrl(url);
      return false;
    }

    if (url.startsWith('about:') || url.startsWith('data:') ||
        url.startsWith('javascript:') || url.startsWith('blob:')) return true;

    if (url.startsWith('intent://')) {
      dbg('BLOCKED intent://');
      return false;
    }

    if (BLOCKED_DOMAINS.some(d => url.includes(d))) {
      dbg('BLOCKED: ' + url.substring(0, 80));
      return false;
    }

    if (ALLOWED_DOMAINS.some(d => url.includes(d))) return true;

    dbg('BLOCKED unknown: ' + url.substring(0, 80));
    return false;
  }, [addUrl, dbg]);

  const handleLoadError = useCallback(() => {
    if (!captured.current) {
      if (collected.current.length > 0) {
        commit();
      } else {
        captured.current = true;
        clearTimeout(collectTimer.current);
        clearTimeout(globalTimer.current);
        dbg('WebView load error');
        onError('load');
      }
    }
  }, [commit, onError, dbg]);

  const handleHttpError = useCallback((e: any) => {
    const code = e?.nativeEvent?.statusCode || 0;
    if (code >= 500 || code === 404) {
      if (!captured.current) {
        if (collected.current.length > 0) {
          commit();
        } else {
          captured.current = true;
          clearTimeout(collectTimer.current);
          clearTimeout(globalTimer.current);
          dbg('HTTP error: ' + code);
          onError('http');
        }
      }
    } else {
      dbg('HTTP warn (ignored): ' + code);
    }
  }, [commit, onError, dbg]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0,
        width: SW, height: SH,
        opacity: 0, overflow: 'hidden', zIndex: -1,
      }}
    >
      <WebView
        source={{uri: pageUrl}}
        style={{width: SW, height: SH}}
        javaScriptEnabled
        injectedJavaScriptBeforeContentLoaded={PATCH_JS}
        injectedJavaScript={CLICK_JS}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoad={() => dbg('LOADED')}
        onError={handleLoadError}
        onHttpError={handleHttpError}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        scalesPageToFit={false}
        domStorageEnabled
        thirdPartyCookiesEnabled
        originWhitelist={['*']}
        {...(Platform.OS === 'android' ? {
          setSupportMultipleWindows: false,
          mixedContentMode: 'compatibility' as const,
        } : {})}
      />
    </View>
  );
};