import React from 'react';
import { WebView } from 'react-native-webview';
export default function OfficePreview({ html, uri, onError }: { html?: string; uri?: string; title: string; onError?: () => void }) {
  return <WebView source={uri ? { uri } : { html: html || '' }} originWhitelist={['*']} javaScriptEnabled={!!uri}
    domStorageEnabled={!!uri} onError={onError} onHttpError={onError} setSupportMultipleWindows={false}
    incognito cacheEnabled={false}
    allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
    onShouldStartLoadWithRequest={request => {
      if (request.url === 'about:blank' || request.url.startsWith('about:blank#')) return true;
      if (!uri) return false;
      try {
        const target = new URL(request.url);
        return target.protocol === 'https:' && (target.hostname === 'view.officeapps.live.com' || target.hostname.endsWith('.officeapps.live.com'));
      } catch { return false; }
    }}
    style={{ flex: 1, backgroundColor: '#fff' }} />;
}
