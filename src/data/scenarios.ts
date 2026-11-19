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
export async function refreshCustomScenarios() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch('/api/scenarios/custom', {signal:controller.signal});
    if (!response.ok) throw Error('catalogUnavailable');
    const data = await response.json();
    if (!Array.isArray(data.scenarios)) throw Error('invalidCatalog');
    allScenarios.splice(3, allScenarios.length-3, ...data.scenarios.filter((s: Scenario) => /^S(0[4-9]|[1-9][0-9])$/.test(s.id)));
  } catch { /* Built-in cases remain available in offline PWA mode. */ }
  finally { clearTimeout(timeout); catalogReady = true; notifyCatalog(); }
}
export async function saveCustomScenario(scenario: Scenario) {
  const response = await fetch('/api/scenarios/custom', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(scenario)});
  if(!response.ok)throw Error('saveFailed');
  const {scenario:saved} = await response.json();
  const index=allScenarios.findIndex(s=>s.id===saved.id);
  if(index<0)allScenarios.push(saved);else allScenarios[index]=saved;
  notifyCatalog();
}
export async function deleteCustomScenario(id: string) {
  if(isBuiltInScenario(id))throw Error('protectedScenario');
  const response=await fetch('/api/scenarios/custom/'+encodeURIComponent(id),{method:'DELETE'});
  if(!response.ok)throw Error('deleteFailed');
  const index=allScenarios.findIndex(s=>s.id===id);if(index>=3)allScenarios.splice(index,1);
  notifyCatalog();
}
