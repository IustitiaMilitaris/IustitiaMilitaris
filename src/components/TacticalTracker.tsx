import React from 'react';
import { Shield, Zap, HeartHandshake } from 'lucide-react';
import type { Scores } from '../types';
import type { Language } from '../i18n';
import { translations } from '../i18n';
import polish from '../i18n/polish.json';
export function TacticalTracker({lang,clock,stage,total,detail,scores,onCids,keys=false}:{lang:Language;clock:React.ReactNode;stage:number;total:number;detail:React.ReactNode;scores:Scores;onCids:()=>void;keys?:boolean}) {
 const t=translations[lang];
 return <aside className="tactical-tracker unified-tracker steel-panel p-4 space-y-4 lg:sticky lg:top-20 min-w-0" aria-label={polish[lang].tracker}>
  <h2 className="font-mono text-xs uppercase text-justice-gold text-center">{polish[lang].tracker}</h2>
  <div className="text-center">{clock}</div><p className="text-center">{lang==='uk'?'Етап':'Stage'} {stage} / {total}</p><div className="text-sm text-steel-300 text-center">{detail}</div>
  <dl className="tracker-axes space-y-2">{(['dobrochesnist','efektyvnist','dovira'] as const).map(axis=>{const Icon=axis==='dobrochesnist'?Shield:axis==='efektyvnist'?Zap:HeartHandshake;const score=scores[axis];return <div key={axis} className="rounded-sm border border-steel-700/70 bg-obsidian-900/75 px-3 py-2 flex items-center justify-between gap-2 text-sm"><dt className="flex items-center gap-2"><Icon className="w-4 h-4 shrink-0" aria-hidden="true" />{t.dimensions[axis]}</dt><dd className={`font-mono font-bold px-1.5 py-0.5 rounded-sm ${score>0?'text-status-success':score< -1?'text-status-danger':score<0?'text-status-warning':'text-steel-400'}`}>{score>0?'+':''}{score}</dd></div>;})}</dl>
  <div className="cids-action-row flex justify-center w-full"><button className="action w-full justify-center text-center" onClick={onCids}>{t.step.cidsHelperBtn}</button></div>
  {keys&&<p className="tracker-keys hidden lg:block text-steel-300 text-center whitespace-nowrap">{polish[lang].keys}</p>}
 </aside>;
}
