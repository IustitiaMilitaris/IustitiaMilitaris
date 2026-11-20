import React from 'react';
import { ChevronRight } from 'lucide-react';
import { normMap } from '../data/scenarios';
import { localizeNorm } from '../i18n/content';
import { formatNormBadge, formatNormDisplayId, formatNormChipPoint } from '../i18n/normDisplay';
import type { Language } from '../i18n';

export function NormChips({ ids, lang, onSelect }: { ids: string[]; lang: Language; onSelect: (id: string) => void }) {
  return <div className="norm-chip-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{ids.map(id => {
    const source = normMap.get(id);
    const norm = source ? localizeNorm(source, lang) : undefined;
    return <button type="button" key={id} data-norm-id={id} title={norm ? `${norm.akt} · ${norm.punkt}` : id} onClick={() => onSelect(id)} className="norm-chip overflow-hidden w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-sm border border-steel-700 text-tactical-ice hover:border-tactical-ice transition-colors min-w-0 text-xs">
      <span className="norm-code font-mono min-w-0 flex-1 break-words leading-snug">{norm ? formatNormBadge(norm, lang) : formatNormDisplayId(id, lang)}</span>
      <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    </button>;
  })}</div>;
}
