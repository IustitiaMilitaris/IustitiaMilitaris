import React, { useState } from 'react';
import { Language } from '../i18n';

const images: Record<string, string> = {
  S01: '/images/s1.jpg', S02: '/images/s2.jpg', S03: '/images/s3.jpg'
};

export function ScenarioIllustration({ id, title, lang }: { id: string; title: string; lang: Language }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = images[id];
  if (!src || failedSource === src) return null;
  return (
    <div className="group aspect-video w-full overflow-hidden rounded-sm border border-steel-700/80 bg-obsidian-900 mb-3.5">
      <img src={src} alt={`${lang === 'en' ? 'Case illustration' : 'Ілюстрація задачі'}: ${title}`}
        className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:transform-none"
        onError={() => setFailedSource(src)} />
    </div>
  );
}
