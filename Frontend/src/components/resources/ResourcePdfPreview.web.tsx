import React from 'react';

export default function ResourcePdfPreview({ uri, title, onLoad, onError }: {
  uri: string; title: string; onLoad: () => void; onError: () => void;
}) {
  return <iframe src={uri} title={title} onLoad={onLoad} onError={onError}
    referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', border: 0, background: '#fff' }} />;
}
