import { formatNormBadge, formatNormDisplayId } from '../i18n/normDisplay';
import { AnimatedDetails } from './Collapsible';
import React, { useState } from 'react';
import type { Scenario, Variant } from '../types';
import type { Language } from '../i18n';
import { translations } from '../i18n';
import { stageLabel, optionLabel } from '../i18n/display';
import { normyData } from '../data/scenarios';
import { localizeNorm } from '../i18n/content';
import labels from '../i18n/builderStudio.json';
import { freshVariant, reachableNodes } from '../utils/builderStudio';
export function BuilderNodeEditor({scenario,lang,index,onChange,onSelect,onAdd,onRemove}:{scenario:Scenario;lang:Language;index:number;onChange:(s:Scenario)=>void;onSelect:(i:number)=>void;onAdd:(variantIndex?:number)=>void;onRemove:(i:number)=>void}){
 const t=labels[lang],node=scenario.vuzly[index],[search,setSearch]=useState('');
 const reached=reachableNodes(scenario);
 const update=(fn:(s:Scenario)=>void)=>{const draft=structuredClone(scenario);fn(draft);onChange(draft);};
 const change=(i:number,fn:(v:Variant)=>void)=>update(s=>fn(s.vuzly[index].varianty[i]));
 const norms=normyData.normy.map(n=>localizeNorm(n,lang)).filter(n=>`${n.id} ${formatNormDisplayId(n.id,lang)} ${n.akt} ${n.punkt} ${n.korotko}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="studio-node-layout">
  <aside className="space-y-2 min-w-0" aria-label={translations[lang].builder.nodesTab}>
   {scenario.vuzly.map((n,i)=><button type="button" key={n.id} onClick={()=>onSelect(i)} aria-pressed={i===index} className={`studio-stage w-full text-left ${i===index?'studio-selected':''}`}><strong className="block">{stageLabel(scenario,n.id,lang)} {n.id===scenario.pochatkovyi_vuzol&&`· ${t.start}`}</strong><span className="block text-xs mt-1">{n.varianty.length} {lang==='uk'?'варіантів':'options'} · {reached.has(n.id)?t.reachable:t.unreachable}</span></button>)}
   <button className="im-secondary action w-full" onClick={()=>onAdd()}>{lang==='uk'?'+ Додати етап':'+ Add stage'}</button>
  </aside>
  {node&&<section className="min-w-0 space-y-4" aria-label={t.edit} data-testid="studio-editor">
   <div className="flex flex-wrap items-center justify-between gap-2"><h3>{stageLabel(scenario,node.id,lang)}</h3><button disabled={scenario.vuzly.length<=1} className="im-secondary action" onClick={()=>onRemove(index)}>{t.remove}</button></div>
   <label className="block">{lang==='uk'?'Ситуація етапу':'Stage situation'}<textarea className="im-field w-full mt-1" rows={3} value={node.tekst} onChange={e=>update(s=>{s.vuzly[index].tekst=e.target.value;})}/></label>
   <label className="block">{lang==='uk'?'Запитання':'Question'}<input className="im-field w-full mt-1" value={node.zapytannia} onChange={e=>update(s=>{s.vuzly[index].zapytannia=e.target.value;})}/></label>
   <label className="block">{t.search}<input type="search" data-field="normy" className="im-field w-full mt-1" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {node.varianty.map((v,i)=><AnimatedDetails key={v.id} data-variant-id={v.id} className="studio-option steel-panel p-4" open={i===0}>
    <summary className="cursor-pointer font-mono text-justice-gold">{optionLabel(i,lang)} · {v.tekst}</summary>
    <div className="space-y-3 mt-4">
     <button disabled={node.varianty.length<=(node.id===scenario.pochatkovyi_vuzol?3:2)} className="im-secondary action" onClick={()=>update(s=>{s.vuzly[index].varianty.splice(i,1);})}>{t.remove}</button>
     <label className="block">{lang==='uk'?'Дія':'Action'}<textarea className="im-field w-full" value={v.tekst} onChange={e=>change(i,v=>{v.tekst=e.target.value;})}/></label>
     {(['dobrochesnist','efektyvnist','dovira'] as const).map(axis=><fieldset key={axis} data-field="baly"><legend className="mb-1">{translations[lang].dimensions[axis]}</legend><div className="flex gap-1" role="group" aria-label={translations[lang].dimensions[axis]}>{[-2,-1,0,1,2].map(value=><button type="button" key={value} aria-pressed={v.baly[axis]===value} className={`studio-score ${v.baly[axis]===value?'studio-selected':''}`} onClick={()=>change(i,v=>{v.baly[axis]=value;})}>{value>0?`+${value}`:value}</button>)}</div></fieldset>)}
     <label className="block">{lang==='uk'?'Наступний етап':'Next stage'}<select data-field="nastupnyi_vuzol" className="im-field w-full" value={v.nastupnyi_vuzol||''} onChange={e=>change(i,v=>{v.nastupnyi_vuzol=e.target.value||null;})}><option value="">{t.finish}</option>{scenario.vuzly.filter(n=>n.id!==node.id).map(n=><option value={n.id} key={n.id}>→ {stageLabel(scenario,n.id,lang)}</option>)}</select></label>
     <button className="im-secondary action" onClick={()=>onAdd(i)}>+ {t.bind}</button>
     {(['odrazu','vidkladeni'] as const).map(key=><label className="block" key={key}>{key==='odrazu'?translations[lang].feedback.immediateTitle:translations[lang].feedback.delayedTitle}<textarea className="im-field w-full" value={v.naslidky[key]} onChange={e=>change(i,v=>{v.naslidky[key]=e.target.value;})}/></label>)}
     <label className="block">{t.reason}<textarea className="im-field w-full" value={v.chomu_taki_baly} onChange={e=>change(i,v=>{v.chomu_taki_baly=e.target.value;})}/></label>
     <label className="block">{t.feedback}<textarea className="im-field w-full" value={v.zvorotnyi_zviazok} onChange={e=>change(i,v=>{v.zvorotnyi_zviazok=e.target.value;})}/></label>
     <fieldset><legend>{t.norms}</legend><div className="max-h-64 overflow-y-auto space-y-1 mt-2">{norms.length===0&&<p>{t.empty}</p>}{norms.map(n=><button type="button" key={n.id} title={n.korotko} aria-pressed={v.normy.includes(n.id)} className={`studio-norm w-full text-left ${v.normy.includes(n.id)?'studio-selected':''}`} onClick={()=>update(s=>{const ids=s.vuzly[index].varianty[i].normy;const j=ids.indexOf(n.id);if(j<0)ids.push(n.id);else ids.splice(j,1);const used=new Set(s.vuzly.flatMap(n=>n.varianty.flatMap(v=>v.normy)));s.normy=[...used].map(id=>s.normy.find(n=>n.id===id)||{id,yak_zastosovuietsia:localizeNorm(normyData.normy.find(n=>n.id===id)!,lang).korotko});})}><span className="norm-code">{formatNormBadge(n, lang)}</span> · {n.akt}</button>)}</div></fieldset>
    </div>
   </AnimatedDetails>)}
   <button className="im-secondary action" disabled={node.varianty.length>=4} onClick={()=>{try{update(s=>{s.vuzly[index].varianty.push(freshVariant(s,lang));});}catch{alert(t.limit);}}}>+ {t.addOption}</button>
  </section>}
 </div>;
}
