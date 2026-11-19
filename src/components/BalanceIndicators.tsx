import designLabels from '../i18n/design.json';
import { ui } from '../i18n/ui';
import React from 'react';
import { ShieldCheck, Zap, HeartHandshake, Info } from 'lucide-react';
import { Scores } from '../types';
import { Language, translations } from '../i18n';

interface BalanceIndicatorsProps {
  scores: Scores;
  explanation?: string;
  lang: Language;
  showExplanation?: boolean;
}

export const BalanceIndicators: React.FC<BalanceIndicatorsProps> = ({
  scores,
  explanation,
  lang,
  showExplanation = true
}) => {
  const t = translations[lang];

  const formatDelta = (val: number) => {
    if (val > 0) return `+${val}`;
    return `${val}`;
  };

  const getScoreColor = (val: number) => {
    if (val > 0)
      return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (val === 0) return 'text-slate-300 bg-navy-800 border-navy-700';
    return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
  };

  const getBarWidth = (val: number) => {
    // scale -2..+2 to 0%..100% with 50% as baseline 0
    // -2 => 10%, -1 => 30%, 0 => 50%, +1 => 70%, +2 => 90%
    return `${Math.round(((Math.max(-2, Math.min(2, val)) + 2) / 4) * 80 + 10)}%`;
  };

  const getBarColor = (val: number) => {
    if (val > 0) return 'bg-emerald-500';
    if (val === 0) return 'bg-slate-500';
    return 'bg-rose-500';
  };

  return (
    <div className="steel-panel space-y-3 p-4 rounded-sm bg-obsidian-850 border border-steel-700">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-steel-300 pb-2 border-b border-obsidian-800">
        <span className="font-semibold uppercase tracking-wider text-steel-300">
          {t.feedback.balanceTitle}
        </span>
        <span className="text-[11px] text-status-warning/90 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          {ui(lang, 'm0')}{' '}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="steel-panel p-3 rounded-sm bg-obsidian-850 border border-steel-700 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-steel-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-status-success" />
              {t.dimensions.dobrochesnist}
            </span>
            <span
              className={`im-tag text-xs font-bold px-2 py-0.5 rounded-sm border ${getScoreColor(scores.dobrochesnist)}`}
            >
              {formatDelta(scores.dobrochesnist)}
            </span>
          </div>
          <div className="w-full bg-obsidian-950 h-2 rounded-sm overflow-hidden border border-steel-700/50">
            <div
              className={`h-full rounded-sm transition-all duration-200 ${getBarColor(scores.dobrochesnist)}`}
              style={{ width: getBarWidth(scores.dobrochesnist) }}
            />
          </div>
          <p className="text-xs text-steel-300">
            {
              designLabels[lang][
                scores.dobrochesnist > 0
                  ? 'positive'
                  : scores.dobrochesnist < 0
                    ? 'negative'
                    : 'neutral'
              ]
            }
          </p>
        </div>
        <div className="steel-panel p-3 rounded-sm bg-obsidian-850 border border-steel-700 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-steel-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-status-warning" />
              {t.dimensions.efektyvnist}
            </span>
            <span
              className={`im-tag text-xs font-bold px-2 py-0.5 rounded-sm border ${getScoreColor(scores.efektyvnist)}`}
            >
              {formatDelta(scores.efektyvnist)}
            </span>
          </div>
          <div className="w-full bg-obsidian-950 h-2 rounded-sm overflow-hidden border border-steel-700/50">
            <div
              className={`h-full rounded-sm transition-all duration-200 ${getBarColor(scores.efektyvnist)}`}
              style={{ width: getBarWidth(scores.efektyvnist) }}
            />
          </div>
          <p className="text-xs text-steel-300">
            {
              designLabels[lang][
                scores.efektyvnist > 0
                  ? 'positive'
                  : scores.efektyvnist < 0
                    ? 'negative'
                    : 'neutral'
              ]
            }
          </p>
        </div>
        <div className="steel-panel p-3 rounded-sm bg-obsidian-850 border border-steel-700 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-steel-300 flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-tactical-ice" />
              {t.dimensions.dovira}
            </span>
            <span
              className={`im-tag text-xs font-bold px-2 py-0.5 rounded-sm border ${getScoreColor(scores.dovira)}`}
            >
              {formatDelta(scores.dovira)}
            </span>
          </div>
          <div className="w-full bg-obsidian-950 h-2 rounded-sm overflow-hidden border border-steel-700/50">
            <div
              className={`h-full rounded-sm transition-all duration-200 ${getBarColor(scores.dovira)}`}
              style={{ width: getBarWidth(scores.dovira) }}
            />
          </div>
          <p className="text-xs text-steel-300">
            {
              designLabels[lang][
                scores.dovira > 0
                  ? 'positive'
                  : scores.dovira < 0
                    ? 'negative'
                    : 'neutral'
              ]
            }
          </p>
        </div>
      </div>

      {showExplanation && explanation && (
        <div lang={lang} className="feedback-prose mt-2 text-xs text-steel-300 bg-obsidian-950/70 p-2.5 rounded-sm border border-obsidian-800 leading-relaxed">
          <strong className="text-steel-300">{ui(lang, 'm1')} </strong>
          {explanation}
        </div>
      )}
    </div>
  );
};
