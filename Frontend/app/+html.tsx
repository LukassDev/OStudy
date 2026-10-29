import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Escala a interface web para 90% (equivale ao zoom 90% do browser).
// Só em ecrãs largos, para não encolher a app em telemóveis/tablets.
const WEB_ZOOM_CSS = `
@media (min-width: 900px) {
  html { zoom: 0.9; }
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>OStudy</title>
        <style dangerouslySetInnerHTML={{ __html: WEB_ZOOM_CSS }} />
      </head>
      <body>
        <ScrollViewStyleReset />
        {children}
      </body>
    </html>
  );
}