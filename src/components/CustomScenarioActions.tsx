import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AnimatedOverlay } from './Collapsible';
import { allScenarios, customMetadata, deleteCustomScenario, isBuiltInScenario } from '../data/scenarios';
import type { Language } from '../i18n';
import labels from '../i18n/customScenarios.json';
export function CustomScenarioActions({id,lang}:{id:string;lang:Language}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false),[input,setInput]=useState('');
 const [target,setTarget]=useState<{title:string;revision:string}|null>(null);
 const t=labels[lang];
 if(isBuiltInScenario(id))return null;
 const close=()=>{if(!busy){setOpen(false);setInput('');setError(false);}};
 return <div className="w-full">
  <div data-testid="custom-card-actions" className="grid grid-cols-2 gap-2 w-full mt-2"><a className="action w-full h-full justify-center text-center" href={`/builder/${id}`}>{t.edit}</a><button type="button" className="action-danger w-full h-full justify-center text-center" onClick={()=>{setTarget({title:allScenarios.find(s=>s.id===id)?.nazva || id,revision:customMetadata[id]?.revision || ''});setInput('');setError(false);setOpen(true);}}>{t.delete}</button></div>
  <AnimatedOverlay isOpen={open} onClose={close} className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
   <section role="dialog" aria-modal="true" aria-label={t.confirm} onClick={e=>e.stopPropagation()} className="steel-panel relative p-6 w-full max-w-md space-y-4">
    <button type="button" className="absolute top-3 right-3 p-1 text-steel-300" aria-label={t.close} onClick={close} disabled={busy}><X size={18}/></button>
    <h2 className="font-serif text-2xl flex items-center gap-2 pr-6"><AlertTriangle className="text-status-warning shrink-0" size={22}/>{t.confirm}</h2>
    <p className="text-sm text-steel-300">{t.warning}</p><p data-testid="delete-case-title" className="surface-muted font-semibold break-words">{target?.title}</p>
    <label className="block text-sm space-y-2"><span>{t.typeTitle}</span><input className="im-field field w-full" value={input} placeholder={target?.title} onChange={e=>setInput(e.target.value)} autoComplete="off" /></label>
    {error&&<p role="alert" className="text-status-warning">{t.failed}</p>}
    <div className="grid grid-cols-2 gap-3 w-full"><button className="action w-full justify-center" disabled={busy} onClick={close}>{t.cancel}</button><button className="action-danger w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed" disabled={busy||!target||input.trim()!==target.title.trim()} onClick={async()=>{if(!target||input.trim()!==target.title.trim())return;setBusy(true);setError(false);try{await deleteCustomScenario(id,target.revision);setOpen(false);setInput('');}catch{setError(true);}finally{setBusy(false);}}}>{t.delete}</button></div>
   </section>
  </AnimatedOverlay>
 </div>;
}
