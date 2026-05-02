/**
 * VideoExtractor.tsx
 *
 * On-device video extraction using a hidden WebView.
 *
 * Key fixes vs original:
 *   1. fetch/XHR interception via postMessage (onShouldStartLoadWithRequest
 *      only sees navigations, not XHR/fetch — which is how JWPlayer loads m3u8)
 *   2. IntersectionObserver spoofing so lazy-load fires even in a 1×1 WebView
 *   3. fetch/XHR patch in injectedJavaScriptBeforeContentLoaded so it's in
 *      place before JWPlayer's own scripts execute
 *   4. Scroll/click logic stays in injectedJavaScript (runs after DOM ready)
 *   5. Full viewport size (opacity:0) instead of 1×1 so lazy-load triggers
 *   6. injectedJavaScriptForMainFrameOnly={false} patches cross-origin iframes
 *   7. Verbose [VE] logging throughout — filter with: adb logcat | grep "\[VE\]"
 */

import React, {useRef, useEffect, useCallback} from 'react';
import {Dimensions, View} from 'react-native';
import {WebView, WebViewMessageEvent} from 'react-native-webview';

const {width: SW, height: SH} = Dimensions.get('window');

// ── Ad/tracker domains to block at navigation level ──────────────────
const BLOCKED_DOMAINS = [
  'googletagmanager.com',
  'doubleclick.net',
  'googleadservices.com',
  'google-analytics.com',
  'popads.net',
  'adsterra.com',
  'exponential.com',
  'outbrain.com',
  'taboola.com',
  'scorecardresearch.com',
  'madurird.com',
  'acscdn.com',
  'crumpetprankerstench.com',
  'propellerads.com',
  'clickadu.com',
  'ampproject.org',
  'adnxs.com',
  'ads.yahoo.com',
];

// ── PATCH JS — injected BEFORE any page scripts run ──────────────────
// Must be early so fetch/XHR overrides are in place before JWPlayer loads.
// Also spoofs IntersectionObserver so lazy-load fires in a small WebView.
const PATCH_JS = `
(function() {
  if (window.__vePatched) return;
  window.__vePatched = true;

  console.log('[VE] patch running on', window.location.href);

  // ── postMessage helper ─────────────────────────────────────────────
  function sendM3u8(url) {
    console.log('[VE] m3u8 detected via fetch/XHR:', url);
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({type: 'm3u8', url: url}));
    } catch(e) {
      console.log('[VE] postMessage error:', e);
    }
  }

  function patchContext(win, label) {
    if (!win || win.__vePatched) return;
    win.__vePatched = true;
    console.log('[VE] patching context:', label);

    // ── Patch fetch ────────────────────────────────────────────────
    var origFetch = win.fetch;
    if (origFetch) {
      win.fetch = function(input, init) {
        var url = typeof input === 'string' ? input
                : (input && input.url) ? input.url : String(input);
        console.log('[VE] fetch:', url);
        if (url.includes('.m3u8')) sendM3u8(url);
        return origFetch.apply(this, arguments);
      };
    }

    // ── Patch XHR ──────────────────────────────────────────────────
    var origOpen = win.XMLHttpRequest && win.XMLHttpRequest.prototype.open;
    if (origOpen) {
      win.XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string') {
          console.log('[VE] XHR open:', url);
          if (url.includes('.m3u8')) sendM3u8(url);
        }
        return origOpen.apply(this, arguments);
      };
    }

    // ── Kill popups ────────────────────────────────────────────────
    win.open    = function() { console.log('[VE] blocked window.open'); return null; };
    win.alert   = function() {};
    win.confirm = function() { return false; };
    win.prompt  = function() { return null; };

    // ── Spoof IntersectionObserver ─────────────────────────────────
    // Forces lazy-load iframes to think they're visible even in a tiny WebView
    if (win.IntersectionObserver) {
      var OrigIO = win.IntersectionObserver;
      win.IntersectionObserver = function(callback, options) {
        var io = new OrigIO(callback, options);
        var origObserve = io.observe.bind(io);
        io.observe = function(target) {
          console.log('[VE] IntersectionObserver.observe spoofed for', target.tagName);
          try {
            callback([{
              isIntersecting: true,
              intersectionRatio: 1,
              target: target,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
              time: performance.now(),
            }]);
          } catch(e) {}
          return origObserve(target);
        };
        return io;
      };
      win.IntersectionObserver.prototype = OrigIO.prototype;
    }
  }

  // Patch main frame
  patchContext(window, 'main');

  // ── Patch iframes as they appear ───────────────────────────────────
  function tryPatchIframe(iframe) {
    try {
      var w = iframe.contentWindow;
      var src = iframe.src || '(no src yet)';
      if (w && !w.__vePatched) {
        patchContext(w, 'iframe:' + src);
      }
    } catch(e) {
      console.log('[VE] cross-origin iframe, cannot patch directly:', iframe.src);
    }
  }

  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeName === 'IFRAME') tryPatchIframe(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('iframe').forEach(tryPatchIframe);
        }
      });
    });
  });
  observer.observe(document.documentElement, {childList: true, subtree: true});

  console.log('[VE] patch complete');
})();
true;
`;

// ── CLICK JS — injected after DOM is ready ────────────────────────────
// Scrolls to trigger lazy load then repeatedly clicks play.
const CLICK_JS = `
(function() {
  console.log('[VE] click script running');

  // Block ad link clicks
  document.addEventListener('click', function(e) {
    var target = e.target && e.target.closest && e.target.closest('a');
    if (target && target.href &&
        !target.href.includes('fasel-hd') &&
        !target.href.startsWith('javascript')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Scroll to trigger lazy iframe injection
  console.log('[VE] scrolling to trigger lazy load');
  window.scrollTo(0, document.body.scrollHeight / 2);
  window.dispatchEvent(new Event('scroll'));

  var attempts = 0;
  var interval = setInterval(function() {
    attempts++;
    console.log('[VE] click attempt', attempts);

    // Log iframes present in DOM
    var iframes = document.querySelectorAll('iframe');
    console.log('[VE] iframes in DOM:', iframes.length);
    iframes.forEach(function(f, i) {
      console.log('[VE]   iframe[' + i + '] src:', f.src || '(empty)');
    });

    // Remove ad overlays
    [
      '.popup', '.ad-overlay', '.close-btn', '.modal-overlay',
      '[class*="popup"]', '[class*="overlay"]', '[id*="popup"]',
      '[id*="ad"]', '[class*="ad-"]', '.blockadblock',
    ].forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        console.log('[VE] removed overlay:', sel);
        el.remove();
      });
    });

    // Try play button selectors in priority order
    var selectors = [
      '.jw-icon.jw-icon-display.jw-button-color.jw-reset',
      '.jw-icon-display',
      '.jw-display-icon-container',
      '[class*="play"][class*="jw"]',
      '[class*="play"]',
      'video',
    ];

    var clicked = false;
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        console.log('[VE] clicking in main frame:', selectors[i]);
        el.click();
        clicked = true;
        break;
      }
    }

    // Also try inside same-origin iframes
    iframes.forEach(function(frame, fi) {
      try {
        var doc = frame.contentDocument || frame.contentWindow.document;
        for (var i = 0; i < selectors.length; i++) {
          var el = doc.querySelector(selectors[i]);
          if (el) {
            console.log('[VE] clicking in iframe[' + fi + ']:', selectors[i]);
            el.click();
            break;
          }
        }
      } catch(e) {
        // cross-origin iframe — expected
      }
    });

    if (!clicked) {
      console.log('[VE] no play button found on attempt', attempts);
    }

    if (attempts >= 10) {
      console.log('[VE] max attempts reached, giving up clicks');
      clearInterval(interval);
    }
  }, 1500);
})();
true;
`;

// ── Props ─────────────────────────────────────────────────────────────
interface VideoExtractorProps {
  pageUrl: string;
  onExtracted: (m3u8Url: string) => void;
  onError: () => void;
  timeoutMs?: number;
}

// ── Component ─────────────────────────────────────────────────────────
export const VideoExtractor: React.FC<VideoExtractorProps> = ({
  pageUrl,
  onExtracted,
  onError,
  timeoutMs = 25000,
}) => {
  const captured = useRef(false);
  const timeout  = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    console.log('[VE] mounting — url:', pageUrl, '| timeout:', timeoutMs + 'ms');
    timeout.current = setTimeout(() => {
      if (!captured.current) {
        console.log('[VE] ⏱ timed out — no m3u8 captured within', timeoutMs + 'ms');
        captured.current = true;
        onError();
      }
    }, timeoutMs);
    return () => {
      console.log('[VE] unmounting');
      clearTimeout(timeout.current);
    };
  }, []);

  // ── Receive m3u8 from injected JS via postMessage ─────────────────
  const handleMessage = useCallback((e: WebViewMessageEvent) => {
    const raw = e.nativeEvent.data;
    console.log('[VE] onMessage raw:', raw);

    if (captured.current) {
      console.log('[VE] already captured, ignoring message');
      return;
    }

    try {
      const data = JSON.parse(raw);
      if (data.type === 'm3u8' && data.url) {
        if (data.url.includes('master.m3u8') || !captured.current) {
          console.log('[VE] ✅ capturing:', data.url);
          captured.current = true;
          clearTimeout(timeout.current);
          onExtracted(data.url);
        } else {
          console.log('[VE] skipping non-master m3u8 (will wait for master):', data.url);
        }
      }
    } catch {
      console.log('[VE] non-JSON postMessage:', raw);
    }
  }, [onExtracted]);

  // ── Navigation blocking — ads/popups only ────────────────────────
  const handleShouldStartLoad = useCallback((request: {url: string}) => {
    const url = request.url;
    console.log('[VE] navigation:', url);

    if (url.startsWith('about:') || url.startsWith('data:')) return true;

    if (BLOCKED_DOMAINS.some(d => url.includes(d))) {
      console.log('[VE] ❌ blocked navigation:', url);
      return false;
    }

    return true;
  }, []);

  const handleError = useCallback((e: any) => {
    console.log('[VE] WebView error:', JSON.stringify(e?.nativeEvent));
    if (!captured.current) {
      captured.current = true;
      clearTimeout(timeout.current);
      onError();
    }
  }, [onError]);

  const handleHttpError = useCallback((e: any) => {
    console.log('[VE] HTTP error:', e?.nativeEvent?.statusCode, e?.nativeEvent?.url);
    // Don't call onError for HTTP errors — ads/trackers 4xx shouldn't abort extraction
  }, []);

  return (
    <View
      style={{
        position: 'absolute',
        // Full viewport so IntersectionObserver sees the player as on-screen.
        // opacity:0 + pointerEvents:none = invisible and non-interactive.
        width: SW,
        height: SH,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      <WebView
        source={{uri: pageUrl}}
        style={{width: SW, height: SH}}
        javaScriptEnabled
        // Patch fetch/XHR BEFORE any page scripts run
        injectedJavaScriptBeforeContentLoaded={PATCH_JS}
        // Scroll + click AFTER DOM is ready
        injectedJavaScript={CLICK_JS}
        // Patch ALL frames including cross-origin iframes
        injectedJavaScriptForMainFrameOnly={false}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        userAgent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        scalesPageToFit={false}
        muted
        onError={handleError}
        onHttpError={handleHttpError}
      />
    </View>
  );
};
