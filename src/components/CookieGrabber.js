import React, { useRef } from 'react';
import { WebView } from 'react-native-webview';

export default function CookieGrabber({ onDone }) {
  const webViewRef = useRef(null);

  const injectCookieScript = () => {
    const js = 'window.ReactNativeWebView.postMessage(document.cookie); true;';
    webViewRef.current?.injectJavaScript(js);
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: 'https://www.fasel-hd.cam/main' }}
      onLoadEnd={injectCookieScript}
      onMessage={(e) => onDone(e.nativeEvent.data)}
      style={{ display: 'none' }}
      incognito={false}
      sharedCookiesEnabled={true}
    />
  );
}
