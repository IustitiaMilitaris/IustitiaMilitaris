import React from 'react';
import type { Scenario } from '../types';
import type { Language } from '../i18n';
import { normMap } from '../data/scenarios';
import { localizeNorm } from '../i18n/content';
import { formatNormDisplayId } from '../i18n/normDisplay';

export function NormCards({ ids, scenario, lang, onSelect }: { ids: string[]; scenario: Scenario; lang: Language; onSelect: (id: string) => void }) {
  return <div lang={lang} className="norm-cards grid grid-cols-1 md:grid-cols-2 gap-3">
    {[...new Set(ids)].map(id => {
      const original = normMap.get(id);
      if (!original) return null;
      const norm = localizeNorm(original, lang);
      const application = (scenario.normy.find(n => n.id === id)?.yak_zastosovuietsia || norm.korotko)
        .replace(' Цей запис довідника має статус «не звірено»; потрібна ручна перевірка чинної редакції та застосовності.', '')
        .replace(' This library entry is marked "not verified"; its current wording and applicability require manual checking.', '');
      const verified = norm.status_zvirky !== 'ne-zvireno';
      return <button type="button" key={id} data-norm-id={id} className="norm-summary-card rounded-sm border border-steel-700/80 bg-obsidian-850/70 p-3.5 hover:border-tactical-ice/60 transition-colors text-left min-w-0" onClick={() => onSelect(id)}>
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2"><span className="norm-code font-mono text-xs text-tactical-ice">{formatNormDisplayId(id, lang)}</span><span className="text-[10px] text-steel-300">{verified ? (lang === 'uk' ? 'Звірено' : 'Verified') : (lang === 'uk' ? 'За матеріалами кейсу · не звірено' : 'Case source · not verified')}</span></div>
        <p className="text-xs text-steel-300 mb-1">{norm.punkt}</p>
        <h4 className="font-medium text-steel-100 text-sm mb-2">{norm.akt}</h4>
        <p className="task-prose text-xs text-steel-300 leading-relaxed">{application}</p>
      </button>;
    })}
  </div>;
}
