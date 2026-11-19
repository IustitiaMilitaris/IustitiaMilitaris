import React, { useState } from 'react';
import { AnimatedOverlay } from './Collapsible';
import { deleteCustomScenario, isBuiltInScenario } from '../data/scenarios';
import type { Language } from '../i18n';
import labels from '../i18n/customScenarios.json';
export function CustomScenarioActions({id,lang}:{id:string;lang:Language}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const t=labels[lang];
 if(isBuiltInScenario(id))return null;
 return <div className="space-y-2">
  <div className="flex flex-wrap gap-2"><a className="action" href={`/builder/${id}`}>{t.edit}</a><button type="button" className="action-danger" onClick={()=>setOpen(true)}>{t.delete}</button></div>
  <AnimatedOverlay isOpen={open} onClose={()=>{if(!busy)setOpen(false);}} className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
   <section role="dialog" aria-modal="true" aria-label={t.confirm} onClick={e=>e.stopPropagation()} className="steel-panel p-6 w-full max-w-md space-y-4">
    <h2 className="font-serif text-2xl">{t.confirm}</h2><p>{t.warning}</p>{error&&<p role="alert">{t.failed}</p>}
    <div className="flex flex-wrap gap-2"><button className="action" disabled={busy} onClick={()=>setOpen(false)}>{t.cancel}</button><button className="action-danger" disabled={busy} onClick={async()=>{setBusy(true);setError(false);try{await deleteCustomScenario(id);setOpen(false);}catch{setError(true);}finally{setBusy(false);}}}>{t.delete}</button></div>
   </section>
  </AnimatedOverlay>
 </div>;
}
