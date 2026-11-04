import React from 'react';
export default function OfficePreview({ html, uri, title, onError }: { html?: string; uri?: string; title: string; onError?: () => void }) {
  return <iframe src={uri} srcDoc={uri ? undefined : html} title={title} onError={onError}
    sandbox={uri ? 'allow-scripts allow-same-origin allow-forms allow-downloads' : ''} referrerPolicy="no-referrer"
    style={{ width: '100%', height: '100%', border: 0, background: '#fff' }} />;
}
