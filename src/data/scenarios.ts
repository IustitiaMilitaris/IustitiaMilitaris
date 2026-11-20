import { Scenario, NormsData } from '../types';

import s01 from '../../stsenarii/S01-spravedlyvist-rozpodilu.json';
import s02 from '../../stsenarii/S02-nedotorkannyi-kandydat.json';
import s03 from '../../stsenarii/S03-svoikh-ne-zdaiut.json';
import normyDataRaw from '../../normy.json';

export const allScenarios: Scenario[] = [
  s01 as unknown as Scenario,
  s02 as unknown as Scenario,
  s03 as unknown as Scenario
];

export const teamScenarios: Scenario[] = allScenarios;
export const starterExamples: Scenario[] = [];

export const normyData: NormsData = normyDataRaw as unknown as NormsData;

export const normMap = new Map(normyData.normy.map((n) => [n.id, n]));

const listeners = new Set<() => void>();
let revision = 0;
export let catalogReady = false;
export const isBuiltInScenario = (id: string) => ['S01', 'S02', 'S03'].includes(id);
export const subscribeCatalog = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const catalogRevision = () => revision;
function notifyCatalog() { revision++; listeners.forEach(listener => listener()); }
export type CustomScenarioMetadata = {key:string;revision:string;customImageUrl:string|null};
export let customMetadata:Record<string,CustomScenarioMetadata> = {};
export function replaceCustomCatalog(data:{scenarios:Scenario[];metadata?:Record<string,CustomScenarioMetadata>}) {
 allScenarios.splice(3,allScenarios.length-3,...data.scenarios.filter(s=>/^S(0[4-9]|[1-9][0-9])$/.test(s.id)));
 customMetadata=data.metadata || {};
}
export async function refreshCustomScenarios() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch('/api/scenarios/custom', {signal:controller.signal});
    if (!response.ok) throw Error('catalogUnavailable');
    const data = await response.json();
    if (!Array.isArray(data.scenarios)) throw Error('invalidCatalog');
    replaceCustomCatalog(data);
  } catch { /* Built-in cases remain available in offline PWA mode. */ }
  finally { clearTimeout(timeout); catalogReady = true; notifyCatalog(); }
}
export class ScenarioApiError extends Error {
  constructor(public code:string,public status:number,public details:{field:string;code:string;expected?:unknown}[]=[]){super(code);}
}
export async function saveCustomScenario(scenario: Scenario, options: {imageDataUrl?:string;removeImage?:boolean;revision?:string} = {}) {
  const response = await fetch('/api/scenarios/custom', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario,...options})});
  const result=await response.json().catch(()=>({error:'invalidResponse'}));
  if(!response.ok)throw new ScenarioApiError(result.error || 'serverError',response.status,result.details || []);
  const saved=result.scenario;
  if(!saved || saved.id!==scenario.id)throw new ScenarioApiError('invalidResponse',response.status);
  replaceCustomCatalog(result);
  notifyCatalog();
  return customMetadata[saved.id];
}
export async function deleteCustomScenario(id: string, revision?:string) {
  if(isBuiltInScenario(id))throw Error('protectedScenario');
  const response=await fetch('/api/scenarios/custom/'+encodeURIComponent(id),{method:'DELETE',headers:revision?{'If-Match':revision}:{}});
  const result=await response.json();
  if(!response.ok)throw new ScenarioApiError(result.error || 'deleteFailed',response.status,result.details || []);
  replaceCustomCatalog(result);
  notifyCatalog();
}
