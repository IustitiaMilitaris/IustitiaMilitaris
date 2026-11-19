import React, { useEffect, useState } from 'react';
import type { Language } from '../i18n';
import type { Scenario } from '../types';
import { stageLabel, variantLabel } from '../i18n/display';
import labels from '../i18n/product.json';
type Stats = { nodes:{nodeId:string;completions:number;variants:{variantId:string;percent:number}[]}[] };
export function AnonymousStats({scenario,pathway,attempt,lang,record}:{scenario:Scenario;pathway:{nodeId:string;variantId:string}[];attempt:number;lang:Language;record:boolean}) {
  const [stats,setStats]=useState<Stats|null>(null),[failed,setFailed]=useState(false);
  const signature=JSON.stringify(pathway);
  useEffect(()=>{
    let cancelled=false;
    const comparison=fetch(`/api/stats/${scenario.id}`,{credentials:'omit'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!cancelled)setStats(data);}).catch(()=>{if(!cancelled)setFailed(true);});
    comparison.then(()=>{
    const key=`anonymous-recorded-${scenario.id}-${attempt}`;
    const last=scenario.vuzly.find(n=>n.id===pathway[pathway.length-1]?.nodeId)?.varianty.find(v=>v.id===pathway[pathway.length-1]?.variantId);
    if(record&&last?.nastupnyi_vuzol===null){
      let recorded=false;try{recorded=!!sessionStorage.getItem(key);}catch{}
      if(!recorded){try{sessionStorage.setItem(key,'1');}catch{}
        fetch('/api/stats/record',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenarioId:scenario.id,pathway})}).then(r=>{if(!r.ok)throw Error();}).catch(()=>{try{sessionStorage.removeItem(key);}catch{}});
      }
    }
    });
    return ()=>{cancelled=true;};
  },[scenario.id,signature,attempt,record]);
  const t=labels[lang];
  const nodes=stats?.nodes.filter(n=>pathway.some(p=>p.nodeId===n.nodeId))||[];
  const discussion=nodes.filter(n=>n.completions>=2&&n.variants.filter(v=>v.percent>0).length>1).sort((a,b)=>Math.max(...a.variants.map(v=>v.percent))-Math.max(...b.variants.map(v=>v.percent)))[0];
  return <section className="surface-muted space-y-4" data-testid="anonymous-stats"><h3 className="font-semibold">{t.stats}</h3>{!nodes.some(n=>n.completions)?<p className="text-sm text-steel-300">{failed?t.unavailable:t.empty}</p>:nodes.map(n=>{
    const selected=pathway.find(p=>p.nodeId===n.nodeId)?.variantId;
    return <div key={n.nodeId} className="space-y-2"><h4 className="text-sm">{stageLabel(scenario,n.nodeId,lang)} · {n.completions}</h4>{discussion?.nodeId===n.nodeId&&<span className="badge">{t.discussion}</span>}{n.variants.map(v=><div key={v.variantId} className={`flex gap-2 items-center text-xs ${selected===v.variantId?'text-justice-gold':'text-steel-300'}`}><span>{variantLabel(scenario,n.nodeId,v.variantId,lang)}</span><div className="meter flex-1"><div className="meter-fill" style={{width:`${v.percent}%`}} /></div><span>{v.percent}%</span></div>)}{n.completions>0&&<p className="text-xs text-steel-300">{t.match.replace('{percent}',String(n.variants.find(v=>v.variantId===selected)?.percent||0)).replace('{option}',selected?variantLabel(scenario,n.nodeId,selected,lang):'—')}</p>}</div>;
  })}</section>;
}
