import React, { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { documentHtml } from './mathHtml';

export default function MathDocument({ body, css }: { body: string; css: string }) {
  const [height, setHeight] = useState(40);
  const source = useMemo(() => ({ html: documentHtml(body, css) }), [body, css]);
  return <View style={{ width: '100%', height }}>
    <WebView source={source} style={{ backgroundColor: 'transparent' }}
      scrollEnabled={false} originWhitelist={['*']} setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={request => {
        if (request.url === 'about:blank') return true;
        if (/^https?:\/\//i.test(request.url)) void Linking.openURL(request.url).catch(() => {});
        return false;
      }}
      onMessage={event => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'oren-math-height' && Number.isFinite(data.height) && data.height > 0) setHeight(data.height);
        } catch { /* Ignore unrelated bridge messages. */ }
      }} />
  </View>;
}
