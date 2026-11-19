import customLabels from '../i18n/customScenarios.json';
import { CustomScenarioActions } from './CustomScenarioActions';
import { saveCustomScenario, ScenarioApiError, isBuiltInScenario } from '../data/scenarios';
import { AnimatedDetails, Collapsible } from './Collapsible';
import studioLabels from '../i18n/builderStudio.json';
import { freshNode, freshVariant, reachableNodes, nextScenarioId, knownScenarioIds } from '../utils/builderStudio';
import { BuilderNodeEditor } from './BuilderNodeEditor';
import { ScenarioDescription } from './ScenarioDescription';
import { CaseMetadata } from './CaseMetadata';
import { parseImportedJson } from '../utils/security';
import { caseLabel } from '../i18n/display';
import { localizeScenario } from '../i18n/content';
import { ui } from '../i18n/ui';
import React, { useEffect, useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Play,
  Plus,
  Trash2,
  Layers,
  User,
  Scale,
  ShieldCheck,
  FileCode,
  Sparkles
} from 'lucide-react';
import {
  Scenario,
  Role
} from '../types';
import { normyData, allScenarios } from '../data/scenarios';
import { validateScenario } from '../utils/validator';
import { DecisionTreeSvg } from './DecisionTreeSvg';
import { generateScorm12Zip } from '../utils/scormExport';
import { Language, translations } from '../i18n';

interface ScenarioBuilderProps {
  onTestScenario: (scenario: Scenario) => void;
  lang: Language;
}

export const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({
  onTestScenario,
  lang
}) => {
  const t = translations[lang];
  const studio = studioLabels[lang];
  const custom = customLabels[lang];
  const [saving,setSaving] = useState(false);
  const [saveNotice,setSaveNotice] = useState('');
  const [saveError,setSaveError] = useState(false);
  const persist = async (launch = false) => {
    let draft=structuredClone(scenario);
    if(isBuiltInScenario(draft.id)){
      const id=nextScenarioId(knownScenarioIds(allScenarios));
      if(!id){setSaveNotice(studio.noCaseId);setSaveError(true);return;}
      draft.id=id;setScenarioState(draft);
    }
    delete (draft as unknown as Record<string,unknown>).builtIn;
    setSaving(true);setSaveNotice('');setSaveError(false);
    try { await saveCustomScenario(draft);setDirty(false);setSaveNotice(custom.saved);if(launch)location.assign(`/classroom/host/new?scenario=${draft.id}`); }
    catch(error) {
      setSaveError(true);
      if(error instanceof ScenarioApiError){
        const messages=custom as Record<string,string>;
        setSaveNotice([`${messages[error.code] || error.code} (HTTP ${error.status})`,...error.details.map(detail=>`${detail.field}: ${messages[detail.code] || detail.code}${detail.expected!==undefined&&!/[\u0400-\u04ff]/u.test(JSON.stringify(detail.expected))?' · '+JSON.stringify(detail.expected):''}`)].join('\n'));
      }else setSaveNotice(custom.network);
    }finally{setSaving(false);}
  };
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const copyCase = (source: Scenario): Scenario => {
    const copy = structuredClone(localizeScenario(source, lang));
    copy.dzherelo_vypadku.typ = source.dzherelo_vypadku.typ;
    copy.perevirka_zmistu.fakhivets_dzpk = source.perevirka_zmistu.fakhivets_dzpk;
    return copy;
  };

  const [activeTab, setActiveTab] = useState<
    'general' | 'roles' | 'nodes' | 'verification' | 'graph'
  >('general');

  const [scenario, setScenarioState] = useState<Scenario>(
    (() => { const source = allScenarios.find(s => s.id === window.location.pathname.split('/')[2]); return source ? { ...copyCase(source), id:isBuiltInScenario(source.id) ? nextScenarioId(knownScenarioIds(allScenarios)) || '' : source.id } : undefined; })() || {
      id: nextScenarioId(knownScenarioIds(allScenarios)) || '',
      nazva: ui(lang, 'm53'),
      versiia: '1.0',
      data_stvorennia: '2026-11-16',
      tema: 'konflikt-interesiv',
      audytoriia: [ui(lang, 'm54'), ui(lang, 'm55')],
      tryvalist_khv: 20,
      kontekst: ui(lang, 'm56'),
      diiovi_osoby: [
        {
          id: 'R1',
          rol: ui(lang, 'm57'),
          opys: ui(lang, 'm58'),
          hravets: true
        },
        {
          id: 'R2',
          rol: ui(lang, 'm59'),
          opys: ui(lang, 'm60'),
          hravets: false
        }
      ],
      sytuatsiia: ui(lang, 'm61'),
      tsinnosti_v_konflikti: [
        {
          tsinnist_a: ui(lang, 'm62'),
          tsinnist_b: ui(lang, 'm63'),
          poiasnennia: ui(lang, 'm64')
        }
      ],
      pochatkovyi_vuzol: 'V1',
      vuzly: [
        {
          id: 'V1',
          tekst: '',
          zapytannia: ui(lang, 'm65'),
          varianty: [
            {
              id: 'A',
              tekst: ui(lang, 'm66'),
              naslidky: {
                odrazu: ui(lang, 'm67'),
                vidkladeni: ui(lang, 'm68')
              },
              baly: { dobrochesnist: 2, efektyvnist: 0, dovira: 1 },
              chomu_taki_baly: ui(lang, 'm69'),
              zvorotnyi_zviazok: ui(lang, 'm70'),
              normy: ['ZPK-28'],
              nastupnyi_vuzol: 'V2'
            },
            {
              id: 'B',
              tekst: ui(lang, 'm71'),
              naslidky: {
                odrazu: ui(lang, 'm72'),
                vidkladeni: ui(lang, 'm73')
              },
              baly: { dobrochesnist: -1, efektyvnist: 1, dovira: -1 },
              chomu_taki_baly: ui(lang, 'm74'),
              zvorotnyi_zviazok: ui(lang, 'm75'),
              normy: ['ZPK-42'],
              nastupnyi_vuzol: null
            },
            {
              id: 'C',
              tekst: ui(lang, 'm76'),
              naslidky: {
                odrazu: ui(lang, 'm77'),
                vidkladeni: ui(lang, 'm78')
              },
              baly: { dobrochesnist: 2, efektyvnist: 1, dovira: 2 },
              chomu_taki_baly: ui(lang, 'm79'),
              zvorotnyi_zviazok: ui(lang, 'm80'),
              normy: ['ZPK-28', 'ZPK-44'],
              nastupnyi_vuzol: null
            }
          ]
        },
        {
          id: 'V2',
          tekst: ui(lang, 'm81'),
          zapytannia: ui(lang, 'm82'),
          varianty: [
            {
              id: 'E1',
              tekst: ui(lang, 'm83'),
              naslidky: {
                odrazu: ui(lang, 'm84'),
                vidkladeni: ui(lang, 'm85')
              },
              baly: { dobrochesnist: 2, efektyvnist: 1, dovira: 1 },
              chomu_taki_baly: ui(lang, 'm86'),
              zvorotnyi_zviazok: ui(lang, 'm87'),
              normy: ['ZPK-28'],
              nastupnyi_vuzol: null
            },
            {
              id: 'E2',
              tekst: ui(lang, 'm88'),
              naslidky: {
                odrazu: ui(lang, 'm89'),
                vidkladeni: ui(lang, 'm90')
              },
              baly: { dobrochesnist: -2, efektyvnist: 0, dovira: -2 },
              chomu_taki_baly: ui(lang, 'm91'),
              zvorotnyi_zviazok: ui(lang, 'm92'),
              normy: ['ZPK-41'],
              nastupnyi_vuzol: null
            }
          ]
        }
      ],
      normy: [
        { id: 'ZPK-28', yak_zastosovuietsia: ui(lang, 'm93') },
        { id: 'ZPK-41', yak_zastosovuietsia: ui(lang, 'm94') },
        { id: 'ZPK-42', yak_zastosovuietsia: ui(lang, 'm95') },
        { id: 'ZPK-44', yak_zastosovuietsia: ui(lang, 'm96') }
      ],
      zastosovnist: ui(lang, 'm97'),
      porady: [ui(lang, 'm98'), ui(lang, 'm99')],
      pytannia_dlia_obhovorennia: [ui(lang, 'm100'), ui(lang, 'm101')],
      dzherelo_vypadku: { typ: 'вигаданий', opys: ui(lang, 'm102') },
      perevirka_zmistu: {
        fakhivets_dzpk: 'не проведено',
        khto: null,
        data: null,
        prymitka: ui(lang, 'm103')
      },
      shi: {
        vykorystano: false,
        instrument: null,
        shcho_zrobleno: ui(lang, 'm104'),
        perevirka_liudynoiu: ui(lang, 'm105')
      }
    }
  );

  useEffect(() => {
    if (!/^S\d{2}$/.test(scenario.id)) return;
    try {
      sessionStorage.setItem('builder-scenario-ids', JSON.stringify([...new Set([...knownScenarioIds(allScenarios), scenario.id])]));
    } catch { /* Editing works when session storage is unavailable. */ }
  }, [scenario.id]);

  const setScenario: React.Dispatch<React.SetStateAction<Scenario>> = next => { setDirty(true); setScenarioState(next); };

  const [selectedNodeIdx, setSelectedNodeIdx] = useState<number>(0);
  const [validationRequested, setValidationRequested] = useState(true);
  const validationErrors = validationRequested
    ? validateScenario(scenario, normyData, lang)
    : [];

  const runValidation = () => {
    const errors = validateScenario(scenario, normyData, lang);
    setValidationRequested(true);
    return errors.length === 0;
  };

  const handleDownloadJson = () => {
    const isValid = runValidation();
    if (!isValid && !confirm(ui(lang, 'm106'))) {
      return;
    }
    const jsonStr = JSON.stringify(scenario, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { alert(lang === 'uk' ? 'Файл перевищує 1 МБ' : 'File exceeds 1 MB'); e.target.value = ''; return; }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = parseImportedJson(event.target?.result as string) as Scenario;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || validateScenario(parsed, normyData, lang).length) throw Error('Invalid scenario');
        setScenario(parsed);
        const errors = validateScenario(parsed, normyData, lang);
        setValidationRequested(true);
        alert(ui(lang, 'm107', parsed.nazva || file.name));
      } catch (err) {
        alert(ui(lang, 'm108'));
      }
    };
    reader.readAsText(file);
  };

  const handleTestInSimulator = () => {
    const isValid = runValidation();
    if (!isValid) {
      alert(ui(lang, 'm109', validationErrors.length));
      return;
    }
    onTestScenario(localizeScenario(scenario, lang));
  };

  const handleExportScorm = async () => {
    const isValid = runValidation();
    if (!isValid) {
      alert(ui(lang, 'm110'));
      return;
    }
    try {
      const zipBlob = await generateScorm12Zip(scenario, normyData, lang);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scenario.id}-scorm12.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('SCORM export error', err);
      alert(ui(lang, 'm111'));
    }
  };

  const addNode = (variantIndex?: number) => {
    try {
      const draft = structuredClone(scenario), node = freshNode(draft, lang);
      if (variantIndex !== undefined) draft.vuzly[selectedNodeIdx].varianty[variantIndex].nastupnyi_vuzol = node.id;
      draft.vuzly.push(node);setScenario(draft);setSelectedNodeIdx(draft.vuzly.length-1);setActiveTab('nodes');
    } catch { alert(studio.limit); }
  };
  const removeNode = (index: number) => {
    if (scenario.vuzly.length <= 1) return;
    const draft=structuredClone(scenario),id=draft.vuzly[index].id;
    draft.vuzly.splice(index,1);
    for(const node of draft.vuzly) for(const v of node.varianty) if(v.nastupnyi_vuzol===id)v.nastupnyi_vuzol=null;
    if(draft.pochatkovyi_vuzol===id)draft.pochatkovyi_vuzol=draft.vuzly[0].id;
    setScenario(draft);setSelectedNodeIdx(Math.max(0,index-1));
  };
  const loadDraft = (source?: Scenario) => {
    if(dirty && !confirm(studio.replace))return;
    const id = nextScenarioId([...knownScenarioIds(allScenarios), scenario.id]);
    if (!id) { alert(studio.noCaseId); return; }
    const draft=copyCase(source || allScenarios[0]);draft.id=id;
    if(!source){
      draft.nazva=studio.title;draft.kontekst=studio.context;draft.sytuatsiia=studio.brief;
      draft.vuzly=[];
      for(let i=0;i<3;i++){const node=freshNode(draft,lang);draft.vuzly.push(node);if(i===0)node.varianty.push(freshVariant(draft,lang));node.tekst=`${lang==='uk'?'Етап':'Stage'} ${i+1} · ${studio.stages[i]}\n\n${studio.situation}`;}
      for(let i=0;i<3;i++)for(const v of draft.vuzly[i].varianty)v.nastupnyi_vuzol=i<2?draft.vuzly[i+1].id:null;
      draft.pochatkovyi_vuzol=draft.vuzly[0].id;
      draft.normy=[{id:'ZPK-28',yak_zastosovuietsia:studio.draft}];
      draft.perevirka_zmistu={fakhivets_dzpk:'не проведено',khto:null,data:null,prymitka:studio.draft};
      draft.shi={vykorystano:true,instrument:'OpenAI Codex',shcho_zrobleno:studio.templateAI,perevirka_liudynoiu:studio.draft};
    }
    setScenario(draft);setSelectedNodeIdx(0);setValidationRequested(true);setActiveTab('general');setDirty(false);
  };
  const errorTab = (field: string) => ['vuzly','varianty','baly','nastupnyi_vuzol','pochatkovyi_vuzol','normy'].includes(field)?'nodes':field==='diiovi_osoby'?'roles':field==='shi'||field==='perevirka_zmistu'?'verification':'general';
  const goToError = (error: { field: string; message: string }) => {
    setActiveTab(errorTab(error.field));
    const tokens = new Set(error.message.match(/\b[A-Z][0-9]*\b/g));
    const variantNode = scenario.vuzly.find(node => node.varianty.some(v => tokens.has(v.id)));
    const node = variantNode || [...tokens].map(id => scenario.vuzly.find(node => node.id === id)).find(Boolean);
    const index = node ? scenario.vuzly.indexOf(node) : -1;
    if (index >= 0) setSelectedNodeIdx(index);
    const variant = variantNode?.varianty.find(v => tokens.has(v.id));
    requestAnimationFrame(() => {
      const content = document.querySelector<HTMLElement>('[data-testid="studio-content"]');
      const option = variant && content?.querySelector<HTMLDetailsElement>(`[data-variant-id="${variant.id}"]`);
      if (option) option.open = true;
      const scope = option || content;
      const target = scope?.querySelector<HTMLElement>(`[data-field="${error.field}"]`) || scope?.querySelector<HTMLElement>('.im-field');
      target?.closest('details')?.setAttribute('open', '');
      const field = target?.matches('input, select, textarea, button') ? target : target?.querySelector<HTMLElement>('button, input, select, textarea');
      field?.focus();
      field?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };

  return (
    <div className="builder-studio max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="steel-panel p-6 rounded-sm bg-obsidian-850 border border-steel-700 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="p-2 rounded-sm bg-status-warning/20 text-status-warning border border-status-warning/30">
              <Wrench className="w-5 h-5" />
            </div>
            <h1 className="im-title font-serif text-xl sm:text-2xl font-bold text-white">
              {t.builder.title}
            </h1>
          </div>
          <p className="text-xs text-steel-300 mt-1">{t.builder.subtitle}</p>
        </div>
        <div className="studio-toolbar w-full">
          <div className="builder-main-actions grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button className="im-primary action-primary" disabled={saving} onClick={()=>persist()}>{saving?custom.busy:custom.save}</button>
            <button className="im-secondary action" disabled={saving} onClick={handleTestInSimulator}><Play size={16}/>{custom.solo}</button>
            <button className="im-secondary action" disabled={saving} onClick={()=>persist(true)}>{custom.group}</button>
          </div>
          <div className="builder-utilities grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            <button onClick={runValidation} className="im-secondary action"><ShieldCheck size={16}/>{custom.validate}</button>
            <label className="im-secondary action cursor-pointer"><Upload size={16}/>{custom.import}<input type="file" accept=".json" onChange={handleImportJson} className="hidden"/></label>
            <button onClick={handleDownloadJson} className="im-secondary action"><Download size={16}/>{custom.export}</button>
            <button onClick={handleExportScorm} className="im-secondary action"><Download size={16}/>SCORM 1.2</button>
          </div>
          {saveNotice&&<p role={saveError?'alert':'status'} className="notice whitespace-pre-line mt-3 w-full">{saveNotice}</p>}
        </div>
      </div>
      <section className="steel-panel p-4 space-y-3" aria-label={studio.quick}>
        <h2 className="font-serif text-xl text-steel-100">{studio.quick}</h2>
        <div className="flex flex-wrap gap-2">
          <button className="im-secondary action" onClick={()=>loadDraft()}>{studio.template}</button>
          <label className="flex flex-wrap items-center gap-2">{studio.clone}<select className="im-field" value="" onChange={e=>{const source=allScenarios.find(s=>s.id===e.target.value);if(source)loadDraft(source);}}><option value="">—</option>{allScenarios.map(s=><option key={s.id} value={s.id}>{caseLabel(s.id,lang)}</option>)}</select></label>
          <button className="im-secondary action" aria-expanded={preview} onClick={()=>setPreview(!preview)}>{studio.preview}</button>
        </div>
      </section>
      <section className="surface space-y-3"><h2>{custom.savedCases}</h2>{allScenarios.filter(s=>!isBuiltInScenario(s.id)).map(s=><div key={s.id} className="flex flex-wrap items-center gap-3"><span>{caseLabel(s.id,lang)} · {s.nazva}</span><CustomScenarioActions id={s.id} lang={lang} /></div>)}</section>
      <Collapsible isOpen={preview}><section className="studio-preview steel-panel p-5 space-y-3" aria-label={studio.preview}>
        <button className="im-secondary action" onClick={()=>setPreview(false)}>{studio.close}</button>
        <div className="scenario-card max-w-md mx-auto steel-panel p-5 space-y-3"><span className="badge">{caseLabel(scenario.id,lang)}</span><h3 className="scenario-card-title font-serif text-xl">{scenario.nazva}</h3><ScenarioDescription text={scenario.sytuatsiia} lang={lang} truncate={scenario.id !== 'S02' && !(scenario.id === 'S01' && lang === 'en')}/><CaseMetadata scenario={scenario} lang={lang}/><button className="im-secondary action w-full" onClick={handleTestInSimulator}>{t.catalog.startSolo}</button></div>
      </section></Collapsible>

      {validationErrors.length > 0 ? (
        <div className="steel-panel border-l-[3px] border-l-status-warning p-4 text-xs space-y-1">
          <div className="font-bold flex flex-wrap items-center gap-2 text-status-danger">
            <AlertTriangle className="w-4 h-4" />
            {ui(lang, 'm125')} {validationErrors.length} {ui(lang, 'm126')}{' '}
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {validationErrors.map((err, idx) => (
              <li key={idx}>
                <button className="text-left text-steel-200" onClick={()=>goToError(err)}><strong>{err.field}:</strong> {err.message} <span className="text-tactical-ice">{studio.fix}</span></button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="steel-panel border-l-[3px] border-l-status-success p-3.5 text-steel-200 text-xs flex flex-wrap items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-tactical-ice" />
          <span>{ui(lang, 'm127')} </span>
        </div>
      )}
      <div className="studio-tabs flex border-b border-obsidian-800 gap-1 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'general', label: t.builder.mainInfoTab, icon: FileCode },
          { id: 'roles', label: t.builder.rolesTab, icon: User },
          { id: 'nodes', label: t.builder.nodesTab, icon: Layers },
          {
            id: 'verification',
            label: t.builder.verificationTab,
            icon: Sparkles
          },
          { id: 'graph', label: t.builder.visualGraphTab, icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              aria-pressed={isActive}
              aria-label={tab.label}
              className={`im-secondary px-4 py-2.5 rounded-sm transition-colors flex flex-wrap items-center gap-2 border-t border-x ${
                isActive
                  ? 'border-justice-gold/60 bg-justice-gold/10 text-justice-gold font-bold'
                  : 'bg-obsidian-950 border-transparent text-steel-300 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label} <span className="font-mono">({tab.id==='roles'?scenario.diiovi_osoby.length:tab.id==='nodes'||tab.id==='graph'?scenario.vuzly.length:tab.id==='verification'?2:5})</span> {validationErrors.some(error=>(errorTab(error.field)===tab.id || (tab.id==='graph'&&['vuzly','nastupnyi_vuzol','pochatkovyi_vuzol'].includes(error.field))))&&<span className="text-status-warning" title={studio.error}>!</span>}
            </button>
          );
        })}
      </div>
      <div data-testid="studio-content" className="steel-panel p-6 sm:p-8 rounded-sm bg-obsidian-850 border border-steel-700 shadow-xl space-y-6">
        {activeTab === 'general' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-steel-300 font-bold mb-1">
                  {lang === 'uk' ? 'Задача' : 'Case'}
                </label>
                <div className="space-y-2">
                  <span className="badge">{caseLabel(scenario.id, lang)}</span>
                  <AnimatedDetails>
                    <summary className="text-xs cursor-pointer text-steel-300">
                      {lang === 'uk'
                        ? 'Технічний ID (JSON)'
                        : 'Technical ID (JSON)'}
                    </summary>
                    <input
                      type="text"
                      data-field="id" value={scenario.id}
                      onChange={(e) =>
                        setScenario({ ...scenario, id: e.target.value })
                      }
                      className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2.5 text-white"
                    />
                  </AnimatedDetails>
                </div>
              </div>
              <div>
                <label className="block text-steel-300 font-bold mb-1">
                  {ui(lang, 'm128')}{' '}
                </label>
                <input
                  type="text"
                  data-field="versiia" value={scenario.versiia}
                  onChange={(e) =>
                    setScenario({ ...scenario, versiia: e.target.value })
                  }
                  className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-steel-300 font-bold mb-1">
                  {ui(lang, 'm129')}{' '}
                </label>
                <input
                  type="text"
                  data-field="data_stvorennia" value={scenario.data_stvorennia}
                  onChange={(e) =>
                    setScenario({
                      ...scenario,
                      data_stvorennia: e.target.value
                    })
                  }
                  className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2.5 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-steel-300 font-bold mb-1">
                {ui(lang, 'm130')}{' '}
              </label>
              <input
                type="text"
                data-field="nazva" value={scenario.nazva}
                onChange={(e) =>
                  setScenario({ ...scenario, nazva: e.target.value })
                }
                className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2.5 text-white text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-steel-300 font-bold mb-1">
                  {ui(lang, 'm131')}{' '}
                </label>
                <select
                  data-field="tema" value={scenario.tema}
                  onChange={(e) =>
                    setScenario({ ...scenario, tema: e.target.value })
                  }
                  className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2.5 text-white"
                >
                  <option value="podarunok">{ui(lang, 'm132')} </option>
                  <option value="konflikt-interesiv">
                    {ui(lang, 'm133')}{' '}
                  </option>
                  <option value="vykryvach">{ui(lang, 'm134')} </option>
                  <option value="akademichna-dobrochesnist">
                    {ui(lang, 'm135')}{' '}
                  </option>
                  <option value="sluzhbove-maino">{ui(lang, 'm136')} </option>
                  <option value="kadrovi-rishennia">{ui(lang, 'm137')} </option>
                  <option value="neformalnyi-tysk">{ui(lang, 'm138')} </option>
                  <option value="rozpodil-resursiv">{ui(lang, 'm139')} </option>
                  <option value="pravdyvist-zvitiv">{ui(lang, 'm140')} </option>
                  <option value="inshe">{ui(lang, 'm141')} </option>
                </select>
              </div>

              <div>
                <label className="block text-steel-300 font-bold mb-1">
                  {ui(lang, 'm142')}{' '}
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  data-field="tryvalist_khv" value={scenario.tryvalist_khv}
                  onChange={(e) =>
                    setScenario({
                      ...scenario,
                      tryvalist_khv: parseInt(e.target.value) || 20
                    })
                  }
                  className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2.5 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-steel-300 font-bold mb-1">
                {ui(lang, 'm143')}{' '}
              </label>
              <textarea
                rows={3}
                data-field="kontekst" value={scenario.kontekst}
                onChange={(e) =>
                  setScenario({ ...scenario, kontekst: e.target.value })
                }
                className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-steel-300 font-bold mb-1">
                {ui(lang, 'm144')}{' '}
              </label>
              <textarea
                rows={4}
                data-field="sytuatsiia" value={scenario.sytuatsiia}
                onChange={(e) =>
                  setScenario({ ...scenario, sytuatsiia: e.target.value })
                }
                className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-steel-300 font-bold mb-1">
                {ui(lang, 'm145')}{' '}
              </label>
              <textarea
                rows={3}
                value={scenario.zastosovnist}
                onChange={(e) =>
                  setScenario({ ...scenario, zastosovnist: e.target.value })
                }
                className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2.5 text-white"
              />
            </div>
          </div>
        )}
        {activeTab === 'roles' && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-steel-300">{ui(lang, 'm146')} </span>
              <button
                onClick={() => {
                  const newR: Role = {
                    id: `R${scenario.diiovi_osoby.length + 1}`,
                    rol: ui(lang, 'm147'),
                    opys: ui(lang, 'm148'),
                    hravets: false
                  };
                  setScenario({
                    ...scenario,
                    diiovi_osoby: [...scenario.diiovi_osoby, newR]
                  });
                }}
                className="im-secondary action text-tactical-ice"
              >
                <Plus className="w-3.5 h-3.5" />
                {ui(lang, 'm149')}{' '}
              </button>
            </div>

            <div className="space-y-3">
              {scenario.diiovi_osoby.map((role, rIdx) => (
                <div
                  key={role.id}
                  className="p-4 rounded-sm bg-obsidian-950 border border-obsidian-800 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={role.id}
                        onChange={(e) => {
                          const updated = [...scenario.diiovi_osoby];
                          updated[rIdx].id = e.target.value;
                          setScenario({ ...scenario, diiovi_osoby: updated });
                        }}
                        className="im-field w-16 font-mono font-bold bg-obsidian-850 border border-steel-700 rounded-sm p-1.5 text-center text-tactical-ice"
                      />
                      <input
                        type="text"
                        value={role.rol}
                        placeholder={ui(lang, 'm150')}
                        onChange={(e) => {
                          const updated = [...scenario.diiovi_osoby];
                          updated[rIdx].rol = e.target.value;
                          setScenario({ ...scenario, diiovi_osoby: updated });
                        }}
                        className="im-field w-64 bg-obsidian-850 border border-steel-700 rounded-sm p-1.5 text-white font-semibold"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex flex-wrap items-center gap-2 cursor-pointer text-steel-300">
                        <input
                          type="checkbox"
                          checked={!!role.hravets}
                          onChange={(e) => {
                            // Ensure only one player
                            const updated = scenario.diiovi_osoby.map(
                              (r, i) => ({
                                ...r,
                                hravets: i === rIdx ? e.target.checked : false
                              })
                            );
                            setScenario({ ...scenario, diiovi_osoby: updated });
                          }}
                          className="rounded-sm text-tactical-ice focus:ring-0"
                        />
                        <span>{ui(lang, 'm151')} </span>
                      </label>

                      <button
                        onClick={() => {
                          setScenario({
                            ...scenario,
                            diiovi_osoby: scenario.diiovi_osoby.filter(
                              (_, i) => i !== rIdx
                            )
                          });
                        }}
                        className="p-1 rounded-sm text-steel-400 hover:text-status-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={role.opys}
                    placeholder={ui(lang, 'm152')}
                    onChange={(e) => {
                      const updated = [...scenario.diiovi_osoby];
                      updated[rIdx].opys = e.target.value;
                      setScenario({ ...scenario, diiovi_osoby: updated });
                    }}
                    className="im-field w-full bg-obsidian-850 border border-steel-700 rounded-sm p-2 text-steel-100"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'nodes' && <BuilderNodeEditor scenario={scenario} lang={lang} index={selectedNodeIdx} onChange={setScenario} onSelect={setSelectedNodeIdx} onAdd={addNode} onRemove={removeNode}/>}
        {activeTab === 'verification' && (
          <div className="space-y-4 text-xs">
            <h3 className="im-section-title font-bold text-white uppercase tracking-wider">
              {ui(lang, 'm167')}{' '}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-steel-300 font-bold mb-1">
                  {ui(lang, 'm168')}{' '}
                </label>
                <div className="grid gap-2">{(['не проведено','проведено','проведено із зауваженнями'] as const).map((status,i)=><button type="button" key={status} className={`studio-stage ${scenario.perevirka_zmistu.fakhivets_dzpk===status?'studio-selected':''}`} aria-pressed={scenario.perevirka_zmistu.fakhivets_dzpk===status} onClick={()=>setScenario({...scenario,perevirka_zmistu:{...scenario.perevirka_zmistu,fakhivets_dzpk:status}})}>{ui(lang,(['m169','m170','m171'] as const)[i])}</button>)}</div>
              </div>

              <div>
                <label className="block text-steel-300 font-bold mb-1">
                  {ui(lang, 'm172')}{' '}
                </label>
                <input
                  type="text"
                  value={scenario.perevirka_zmistu.khto || ''}
                  onChange={(e) =>
                    setScenario({
                      ...scenario,
                      perevirka_zmistu: {
                        ...scenario.perevirka_zmistu,
                        khto: e.target.value || null
                      }
                    })
                  }
                  placeholder={ui(lang, 'm173')}
                  className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-steel-300 font-bold mb-1">
                {ui(lang, 'm174')}{' '}
              </label>
              <textarea
                rows={2}
                value={scenario.perevirka_zmistu.prymitka}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    perevirka_zmistu: {
                      ...scenario.perevirka_zmistu,
                      prymitka: e.target.value
                    }
                  })
                }
                className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2 text-white"
              />
            </div>

            <h3 className="im-section-title font-bold text-white uppercase tracking-wider pt-4 border-t border-obsidian-800">
              {ui(lang, 'm175')}{' '}
            </h3>
            <fieldset><legend>{studio.ai}</legend><div className="flex gap-2 mt-2">{[true,false].map(value=><button key={String(value)} className={`studio-stage ${scenario.shi.vykorystano===value?'studio-selected':''}`} aria-pressed={scenario.shi.vykorystano===value} onClick={()=>setScenario({...scenario,shi:{...scenario.shi,vykorystano:value,instrument:value?scenario.shi.instrument:null}})}>{value?studio.yes:studio.no}</button>)}</div></fieldset>
            <Collapsible isOpen={scenario.shi.vykorystano}><div className="space-y-3">            <div>
              <label className="block text-steel-300 font-bold mb-1">
                {ui(lang, 'm176')}{' '}
              </label>
              <input
                type="text"
                value={scenario.shi.instrument || ''}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    shi: { ...scenario.shi, instrument: e.target.value || null }
                  })
                }
                placeholder="Claude (Anthropic) / Antigravity"
                className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2 text-white"
              />
            </div>

            <div>
              <label className="block text-steel-300 font-bold mb-1">
                {ui(lang, 'm177')}{' '}
              </label>
              <textarea
                rows={2}
                value={scenario.shi.shcho_zrobleno}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    shi: { ...scenario.shi, shcho_zrobleno: e.target.value }
                  })
                }
                className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2 text-white"
              />
            </div>

</div></Collapsible>
            <div>
              <label className="block text-steel-300 font-bold mb-1">
                {ui(lang, 'm178')}{' '}
              </label>
              <textarea
                rows={2}
                value={scenario.shi.perevirka_liudynoiu}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    shi: {
                      ...scenario.shi,
                      perevirka_liudynoiu: e.target.value
                    }
                  })
                }
                className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm p-2 text-white"
              />
            </div>
          </div>
        )}
        {activeTab === 'graph' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-steel-300">
              <span>{ui(lang, 'm179')} </span>
              <span className="font-mono">
                {scenario.vuzly.length} {ui(lang, 'm180')}{' '}
              </span>
            </div>
            <DecisionTreeSvg scenario={scenario} currentNodeId={scenario.vuzly[selectedNodeIdx]?.id} unreachableNodeIds={scenario.vuzly.filter(n=>!reachableNodes(scenario).has(n.id)).map(n=>n.id)} onSelectNode={id=>{setSelectedNodeIdx(scenario.vuzly.findIndex(n=>n.id===id));setActiveTab('nodes');}} />
          </div>
        )}
      </div>
    </div>
  );
};
