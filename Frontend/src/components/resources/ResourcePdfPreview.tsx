import React from 'react';
import { WebView } from 'react-native-webview';

// iOS has a built-in PDF renderer. Android uses the external-open fallback.
export default function ResourcePdfPreview({ uri, onLoad, onError }: {
  uri: string; title: string; onLoad: () => void; onError: () => void;
}) {
  return <WebView source={{ uri }} onLoadEnd={onLoad} onError={onError} onHttpError={onError}
    javaScriptEnabled={false} style={{ flex: 1 }} />;
}
