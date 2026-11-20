import { customMetadata } from '../data/scenarios';
import { TacticalTracker } from './TacticalTracker';
import productLabels from '../i18n/product.json';
import { useScenarioTiming, formatElapsed } from '../hooks/useScenarioTiming';
import { TimingDisplay } from './TimingDisplay';
import { AnonymousStats } from './AnonymousStats';
import { HighlightedText } from './HighlightedText';
import { NormChips } from './NormChips';
import { NormCards } from './NormCards';
import { Collapsible } from './Collapsible';
import polish from '../i18n/polish.json';
import { caseLabel, stageLabel, variantLabel, scenarioStageCount } from '../i18n/display';
import {
  Dossier,
  ValueConflict,
  Consequence
} from './BriefingDesign';
import { localizeNorm, localizeScenario } from '../i18n/content';
import { ui } from '../i18n/ui';
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  User,
  CheckCircle2,
  AlertTriangle,
  Download,
  Scale,
  BookOpen,
  Layers
} from 'lucide-react';
import { Scenario, Variant, NormEntry } from '../types';
import { normMap as originalNormMap, normyData } from '../data/scenarios';
import { BalanceIndicators } from './BalanceIndicators';
import { CidsHelperModal } from './CidsHelperModal';
import { NormDetailModal } from './NormDetailModal';
import { DecisionTreeSvg } from './DecisionTreeSvg';
import { generateScorm12Zip } from '../utils/scormExport';
import { Language, translations } from '../i18n';

interface SoloSimulatorProps {
  scenario: Scenario;
  onBackToCatalog: () => void;
  lang: Language;
}

export const SoloSimulator: React.FC<SoloSimulatorProps> = ({
  scenario: sourceScenario,
  onBackToCatalog,
  lang
}) => {
  const scenario = localizeScenario(sourceScenario, lang);
  const normMap = new Map(
    [...originalNormMap].map(([id, norm]) => [id, localizeNorm(norm, lang)])
  );
  const t = translations[lang];
  const copy = polish[lang];

  // Simulator stage: 'briefing' | 'decision' | 'feedback' | 'reflection'
  const [phase, setPhase] = useState<
    'briefing' | 'decision' | 'feedback' | 'reflection'
  >(() =>
    window.location.pathname.endsWith('/summary')
      ? 'reflection'
      : window.location.pathname.endsWith('/play')
        ? 'decision'
        : 'briefing'
  );
  const [currentNodeId, setCurrentNodeId] = useState<string>(
    scenario.pochatkovyi_vuzol
  );
  const [storedSelectedVariant, setSelectedVariant] = useState<Variant | null>(
    null
  );
  const [storedPendingVariant, setPendingVariant] = useState<Variant | null>(
    null
  );

  // History pathway: array of { nodeId, variant }
  const [storedPathway, setPathway] = useState<
    { nodeId: string; variant: Variant }[]
  >([]);

  // Resolve displayed text from stable IDs on every render, including after a
  // language change. Stored choices and progress do not need to be reset.
  const resolveVariant = (nodeId: string, variant: Variant | null) =>
    variant
      ? (scenario.vuzly
          .find((n) => n.id === nodeId)
          ?.varianty.find((v) => v.id === variant.id) ?? variant)
      : null;
  const selectedVariant = resolveVariant(currentNodeId, storedSelectedVariant);
  const pendingVariant = resolveVariant(currentNodeId, storedPendingVariant);
  const pathway = storedPathway.map((step) => ({
    ...step,
    variant: resolveVariant(step.nodeId, step.variant)!
  }));

  // Modals
  const [isCidsOpen, setIsCidsOpen] = useState(false);
  const [activeNormDetail, setActiveNormDetail] = useState<{
    norm: NormEntry;
    note?: string;
  } | null>(null);
  const [showValuesConflict, setShowValuesConflict] = useState(false);
  const [recordStats, setRecordStats] = useState(false);
  const [isExportingScorm, setIsExportingScorm] = useState(false);

  const caseKey=useRef(customMetadata[scenario.id]?.key).current;
  const storageId=caseKey?`custom_${caseKey}`:scenario.id;
  const timer = useScenarioTiming(storageId, phase);
  const product = productLabels[lang];
  useEffect(() => {
    if (
      !window.location.pathname.endsWith('/play') &&
      !window.location.pathname.endsWith('/summary')
    )
      return;
    let cancelled = false;
    fetch('/api/progress')
      .then(async (response) => {
        let progress;
        if (response.ok) progress = (await response.json())[scenario.id];
        else if (response.status === 401) {
          try {
            progress = JSON.parse(
              localStorage.getItem(`simulator_progress_${storageId}`) ||
                'null'
            );
          } catch {}
        } else return;
        if (cancelled || !progress?.pathway?.length) return;
        const restored = progress.pathway
          .map((entry: { nodeId: string; variantId: string }) => ({
            nodeId: entry.nodeId,
            variant: scenario.vuzly
              .find((n) => n.id === entry.nodeId)
              ?.varianty.find((v) => v.id === entry.variantId)
          }))
          .filter((entry: { variant?: Variant }) => entry.variant);
        if (!restored.length) return;
        setPathway(restored);
        const last = restored[restored.length - 1];
        if(progress.timing||last.variant.nastupnyi_vuzol===null) timer.restore(progress.timing,last.variant.nastupnyi_vuzol===null);
        setCurrentNodeId(last.variant.nastupnyi_vuzol || last.nodeId);
        setPhase(last.variant.nastupnyi_vuzol ? 'decision' : 'reflection');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [scenario.id]);

  const saveLocalProgress = (
    newPathway: { nodeId: string; variant: Variant }[]
  ) => {
    const progress = {
      scenarioId: scenario.id,
      caseKey,
      timing: timer.timing,
      pathway: newPathway.map((p) => ({
        nodeId: p.nodeId,
        variantId: p.variant.id
      }))
    };
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress)
    })
      .then((response) => {
        if (response.status === 401) {
          try {
            localStorage.setItem(
              `simulator_progress_${storageId}`,
              JSON.stringify(progress)
            );
          } catch {}
        }
      })
      .catch(() => {});
  };

  useEffect(() => { if(phase==='reflection' && timer.completed && timer.hasTiming && pathway.length) saveLocalProgress(pathway); }, [phase,timer.completed]);

  const handleStartFromBriefing = () => {
    timer.start();
    window.history.pushState({}, '', `/scenarios/${scenario.id}/play`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    setPhase('decision');
    setCurrentNodeId(scenario.pochatkovyi_vuzol);
    setSelectedVariant(null);
    setPendingVariant(null);
  };

  const handleConfirmDecision = () => {
    if (!pendingVariant) return;
    setSelectedVariant(pendingVariant);
    const newPathway = [
      ...pathway,
      { nodeId: currentNodeId, variant: pendingVariant }
    ];
    setPathway(newPathway);
    saveLocalProgress(newPathway);
    setPhase('feedback');
  };

  const handleNextStep = () => {
    if (!selectedVariant) return;

    if (selectedVariant.nastupnyi_vuzol) {
      setCurrentNodeId(selectedVariant.nastupnyi_vuzol);
      setSelectedVariant(null);
      setPendingVariant(null);
      setPhase('decision');
    } else {
      setRecordStats(true);
      setPhase('reflection');
    }
  };

  const handleRestart = () => {
    setRecordStats(false);
    timer.reset();
    localStorage.removeItem(`simulator_progress_${storageId}`);
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: scenario.id, caseKey, pathway: [] })
    }).catch(() => {});
    setPathway([]);
    setCurrentNodeId(scenario.pochatkovyi_vuzol);
    setSelectedVariant(null);
    setPendingVariant(null);
    setPhase('briefing');
  };

  const handleExportScorm = async () => {
    try {
      setIsExportingScorm(true);
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
      alert(ui(lang, 'm213'));
    } finally {
      setIsExportingScorm(false);
    }
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.repeat || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isCidsOpen || activeNormDetail || document.querySelector('[role="dialog"]') || target?.closest('input,textarea,select,button,a,summary,[contenteditable]:not([contenteditable="false"])')) return;
      if (phase === 'decision' && /^[1-4]$/.test(event.key)) {
        const variant = scenario.vuzly.find(n => n.id === currentNodeId)?.varianty[Number(event.key) - 1];
        if (variant) { event.preventDefault(); setPendingVariant(variant); }
      } else if (event.key === 'Enter' && (phase === 'decision' || phase === 'feedback')) {
        event.preventDefault();
        if (phase === 'decision') handleConfirmDecision(); else handleNextStep();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const openNormModal = (normId: string) => {
    const entry = normMap.get(normId);
    if (!entry) return;
    const scenNorm = scenario.normy.find((n) => n.id === normId);
    setActiveNormDetail({ norm: entry, note: scenNorm?.yak_zastosovuietsia });
  };

  const currentNode = scenario.vuzly.find((v) => v.id === currentNodeId);

  // Compute final separate balance points (no summing across axes!)
  const cumulativeScores = pathway.reduce(
    (acc, step) => ({
      dobrochesnist: acc.dobrochesnist + step.variant.baly.dobrochesnist,
      efektyvnist: acc.efektyvnist + step.variant.baly.efektyvnist,
      dovira: acc.dovira + step.variant.baly.dovira
    }),
    { dobrochesnist: 0, efektyvnist: 0, dovira: 0 }
  );

  return (
    <div className={`solo-shell mx-auto px-4 sm:px-6 py-8 ${phase === 'decision' || phase === 'feedback' ? 'max-w-6xl' : 'max-w-4xl'}`}>
      {phase === 'briefing' && (
        <div
          key={`${scenario.id}:${phase}:${currentNodeId}`}
          className="space-y-6 animate-fadeIn"
        >
          <div className="steel-panel p-6 sm:p-8 rounded-sm bg-obsidian-850 border border-steel-700 shadow-xl space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-justice-gold">
                {t.briefing.title}
              </span>
              <h1 className="im-title font-serif text-xl sm:text-2xl font-extrabold text-white mt-1">
                {scenario.nazva}
              </h1>
            </div>
            <div className="p-4 rounded-sm bg-obsidian-950/80 border-l-4 border-tactical-ice text-sm text-steel-100 leading-relaxed">
              <strong className="text-tactical-ice block mb-1">
                {ui(lang, 'm214')}{' '}
              </strong>
              <HighlightedText text={scenario.kontekst} />
            </div>
            <div className="space-y-2">
              <h2 className="im-title font-serif text-sm font-bold text-steel-300 uppercase tracking-wider">
                {t.briefing.situationTitle}
              </h2>
              <Dossier scenario={scenario} lang={lang}>
                {scenario.sytuatsiia}
              </Dossier>
            </div>
            <div className="space-y-3">
              <h2 className="im-title font-serif text-sm font-bold text-steel-300 uppercase tracking-wider flex flex-wrap items-center gap-2">
                <User className="w-4 h-4 text-justice-gold" />
                {t.briefing.rolesTitle}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {scenario.diiovi_osoby.map((role) => (
                  <div
                    key={role.id}
                    className={`p-3.5 rounded-sm border transition-all ${
                      role.hravets
                        ? 'bg-justice-gold/10 border-justice-gold/50 shadow-sm'
                        : 'bg-obsidian-950 border-obsidian-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm text-white">
                        {role.rol}
                      </span>
                      {role.hravets && (
                        <span className="im-tag text-[10px] font-bold px-2 py-0.5 rounded-sm bg-justice-gold/20 text-justice-gold border border-justice-gold/30">
                          {t.briefing.playerBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-steel-300 leading-relaxed">
                      {role.opys}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-sm border border-steel-700 overflow-hidden bg-obsidian-950">
              <button
                aria-expanded={showValuesConflict} onClick={() => setShowValuesConflict(!showValuesConflict)}
                className="im-secondary w-full p-4 flex flex-wrap items-center justify-between gap-2 text-left text-sm font-semibold text-status-warning hover:bg-obsidian-850 transition-colors"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Scale className="w-4 h-4 text-status-warning" />
                  {t.briefing.valuesConflictTitle}
                </span>
                <ChevronDown className={`w-4 h-4 collapse-chevron ${showValuesConflict ? 'is-open' : ''}`} />
              </button>
              <Collapsible isOpen={showValuesConflict}>
                <div className="animate-fadeIn p-4 border-t border-obsidian-800 space-y-3 text-xs sm:text-sm">
                  {scenario.tsinnosti_v_konflikti.map((c, idx) => (
                    <div
                      key={idx}
                      className="steel-panel p-3 rounded-sm bg-obsidian-850 border border-obsidian-800"
                    >
                      <ValueConflict
                        a={c.tsinnist_a}
                        b={c.tsinnist_b}
                        explanation={c.poiasnennia}
                      />
                    </div>
                  ))}
                </div>
              </Collapsible>
            </div>
            <fieldset className="space-y-2"><legend className="text-sm font-semibold">{product.time}</legend><div className="grid gap-2 sm:grid-cols-3">{[0,10,15].map(mode=><button type="button" key={mode} aria-pressed={timer.mode===mode} className={`action ${timer.mode===mode?'border-justice-gold text-justice-gold':''}`} onClick={()=>timer.setMode(mode)}>{mode===0?product.unlimited:mode===10?product.ten:product.fifteen}</button>)}</div></fieldset>
            <button
              onClick={handleStartFromBriefing}
              className="im-primary w-full py-3.5 px-6 rounded-sm bg-justice-gold hover:bg-justice-gold text-white font-bold text-sm sm:text-base transition-all shadow-lg shadow-panel flex items-center justify-center gap-2"
            >
              <span>{t.briefing.startScenario}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      <div className={phase === 'decision' || phase === 'feedback' ? 'play-layout grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start' : ''}>
      <div className="min-w-0 w-full">
      {phase === 'decision' && currentNode && (
        <div
          key={`${scenario.id}:${phase}:${currentNodeId}`}
          className="space-y-6 animate-fadeIn"
        >
          <div className="steel-panel p-6 sm:p-8 rounded-sm bg-obsidian-850 border border-steel-700 shadow-xl space-y-6">
            <Dossier
              scenario={scenario}
              lang={lang}
              nodeId={currentNodeId}
              index={
                pathway.filter((p) => p.nodeId !== currentNodeId).length + 1
              }
            >
              {currentNode.tekst || scenario.sytuatsiia}
            </Dossier>

            <div>
              <h2 data-testid="stage-question" className="im-title font-serif text-base sm:text-xl font-bold text-white leading-snug text-center w-full">
                {currentNode.zapytannia}
              </h2>
              <p className="text-xs text-steel-300 mt-1">
                {t.step.selectPrompt}
              </p>
            </div>
            <div className="space-y-3">
              {currentNode.varianty.map((v) => {
                const isSelected = pendingVariant?.id === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setPendingVariant(v)}
                    className={`steel-panel im-choice p-4 sm:p-5 rounded-sm border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-justice-gold/10 border-justice-gold border-l-[3px] border-l-justice-gold text-steel-100 shadow-md shadow-panel'
                        : 'bg-obsidian-950/70 border-obsidian-800 text-steel-300 hover:bg-obsidian-850 hover:border-steel-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`im-tag w-7 h-7 rounded-sm flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-justice-gold text-obsidian-950'
                            : 'bg-obsidian-800 text-steel-300 border border-steel-700'
                        }`}
                      >
                        {variantLabel(scenario, currentNodeId, v.id, lang)}
                      </span>
                      <div className="text-sm sm:text-base leading-relaxed">
                        {v.tekst}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleConfirmDecision}
              disabled={!pendingVariant}
              className={`im-primary w-full py-3 px-6 rounded-sm font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 ${
                pendingVariant
                  ? 'bg-justice-gold hover:bg-justice-gold text-white shadow-lg cursor-pointer'
                  : 'bg-obsidian-800 text-steel-400 border border-steel-700 cursor-not-allowed'
              }`}
            >
              <span>
                {pendingVariant
                  ? t.step.confirmChoice
                  : t.step.selectToContinue}
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {phase === 'feedback' && selectedVariant && (
        <div
          key={`${scenario.id}:${phase}:${currentNodeId}`}
          className="space-y-6 animate-fadeIn"
        >
          <Dossier scenario={scenario} lang={lang} nodeId={currentNodeId} index={pathway.filter(p=>p.nodeId!==currentNodeId).length+1}>{currentNode?.tekst || scenario.sytuatsiia}</Dossier>
          <div className="steel-panel p-6 sm:p-8 rounded-sm bg-obsidian-850 border border-steel-700 shadow-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-obsidian-800">
              <span className="text-xs font-bold uppercase tracking-wider text-justice-gold">
                {t.feedback.title}
              </span>
              <span className="im-tag font-mono text-xs font-bold px-2 py-0.5 rounded-sm bg-justice-gold/20 text-justice-gold border border-justice-gold/30">
                {lang === 'uk' ? 'Варіант' : 'Option'}{' '}
                {variantLabel(
                  scenario,
                  currentNodeId,
                  selectedVariant.id,
                  lang
                )}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Consequence title={copy.immediate}>
                {selectedVariant.naslidky.odrazu}
              </Consequence>
              <Consequence delayed title={copy.delayed}>
                {selectedVariant.naslidky.vidkladeni}
              </Consequence>
            </div>
            <BalanceIndicators
              scores={selectedVariant.baly}
              explanation={selectedVariant.chomu_taki_baly}
              lang={lang}
            />
            <div lang={lang} className="feedback-prose p-4 rounded-sm bg-obsidian-950 border-l-4 border-justice-gold text-xs sm:text-sm text-steel-100 leading-relaxed">
              <strong className="text-justice-gold block mb-1">
                {t.feedback.analysisTitle}
              </strong>
              {selectedVariant.zvorotnyi_zviazok}
            </div>
            {selectedVariant.normy && selectedVariant.normy.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-tactical-ice uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  {t.feedback.normsTitle}
                </div>
<NormChips ids={selectedVariant.normy} lang={lang} onSelect={openNormModal} />
              </div>
            )}
            <button
              onClick={handleNextStep}
              className="im-primary w-full py-3.5 px-6 rounded-sm bg-justice-gold hover:bg-justice-gold text-white font-bold text-sm sm:text-base transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <span>
                {selectedVariant.nastupnyi_vuzol
                  ? t.feedback.nextStep
                  : t.feedback.finishScenario}
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      </div>
      {(phase === 'decision' || phase === 'feedback') && <TacticalTracker lang={lang} stage={pathway.filter(p=>p.nodeId!==currentNodeId).length+1} total={scenarioStageCount(scenario)} detail={scenario.diiovi_osoby.find(r=>r.hravets)?.rol} scores={cumulativeScores} onCids={()=>setIsCidsOpen(true)} keys clock={<>
        <div data-testid="scenario-timer" className={`tracker-clock text-center font-mono text-3xl sm:text-4xl font-bold tracking-wider transition-colors ${timer.mode>0&&timer.mode*60-timer.elapsedSeconds<120?'text-status-warning':'tracker-clock-normal'}`}>{formatElapsed(timer.mode?Math.max(0,timer.mode*60-timer.elapsedSeconds):timer.elapsedSeconds)}</div>
        {timer.mode>0&&timer.elapsedSeconds>=timer.mode*60&&<p role="status" className="text-xs text-status-warning">{product.expired}</p>}
      </>} />}

      </div>
      {phase === 'reflection' && (
        <div
          key={`${scenario.id}:${phase}:${currentNodeId}`}
          className="summary-sheet space-y-6 animate-fadeIn"
        >
          <div className="steel-panel p-6 sm:p-8 rounded-sm bg-obsidian-850 border border-steel-700 shadow-xl space-y-6">
            <div className="border-b border-obsidian-800 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-justice-gold">
                  {t.reflection.title}
                </span>
                <h1 className="im-title font-serif text-xl sm:text-2xl font-extrabold text-white mt-1">
                  {scenario.nazva}
                </h1>
              </div>
              <span className="im-tag px-3 py-1 rounded-sm bg-justice-gold/20 text-justice-gold border border-justice-gold/30 text-xs font-semibold">
                {ui(lang, 'm216')}{' '}
              </span>
            </div>
            <div className="w-full space-y-5">
              <div className="space-y-2">
                <h3 className="im-section-title text-sm font-bold text-steel-300 uppercase tracking-wider flex flex-wrap items-center gap-2">
                  <Layers className="w-4 h-4 text-justice-gold" />
                  {t.reflection.pathwayTitle}
                </h3>
                <DecisionTreeSvg
                  scenario={scenario}
                  selectedPath={pathway.map(p => ({ nodeId: p.nodeId, variantId: p.variant.id }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              {pathway.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-sm bg-obsidian-950 border border-obsidian-800 flex items-start justify-between gap-3 text-xs sm:text-sm"
                >
                  <div>
                    <span className="font-mono font-bold text-justice-gold mr-2">
                      {stageLabel(scenario, p.nodeId, lang)}
                    </span>
                    <span className="font-semibold text-white">
                      {lang === 'uk' ? 'Варіант' : 'Option'}{' '}
                      {variantLabel(scenario, p.nodeId, p.variant.id, lang)}:
                    </span>
                    <p className="text-steel-300 mt-1">{p.variant.tekst}</p>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[11px] shrink-0 ml-4">
                    <span className="text-justice-gold">
                      {ui(lang, 'm219')}{' '}
                      {p.variant.baly.dobrochesnist > 0
                        ? `+${p.variant.baly.dobrochesnist}`
                        : p.variant.baly.dobrochesnist}
                    </span>
                    <span className="text-status-warning ml-1">
                      {ui(lang, 'm220')}{' '}
                      {p.variant.baly.efektyvnist > 0
                        ? `+${p.variant.baly.efektyvnist}`
                        : p.variant.baly.efektyvnist}
                    </span>
                    <span className="text-tactical-ice ml-1">
                      {ui(lang, 'm221')}{' '}
                      {p.variant.baly.dovira > 0
                        ? `+${p.variant.baly.dovira}`
                        : p.variant.baly.dovira}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <h3 className="im-section-title text-sm font-bold text-steel-300 uppercase tracking-wider">
                {t.reflection.profileTitle}
              </h3>

              <BalanceIndicators
                scores={cumulativeScores}
                lang={lang}
                showExplanation={false}
              />
              <p className="text-[11px] text-steel-300 mt-1 leading-relaxed">
                {t.reflection.profileNotice}
              </p>
            </div>
            <div className="p-4 rounded-sm bg-obsidian-950 border border-obsidian-800 space-y-1.5 text-xs sm:text-sm">
              <h3 className="im-section-title text-xs font-bold text-tactical-ice uppercase tracking-wider">
                {t.reflection.applicabilityTitle}
              </h3>
              <p className="text-steel-300 leading-relaxed">
                {scenario.zastosovnist}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="im-section-title text-sm font-bold text-status-warning uppercase tracking-wider">
                {t.reflection.adviceTitle}
              </h3>
              <ul className="space-y-2">
                {scenario.porady.map((advice, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs sm:text-sm text-steel-100"
                  >
                    <CheckCircle2 className="w-4 h-4 text-justice-gold shrink-0 mt-0.5" />
                    <span>{advice}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-3.5 rounded-sm bg-justice-gold/10 border border-justice-gold/25 text-xs text-justice-gold flex flex-wrap items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-justice-gold shrink-0" />
              <span>{t.reflection.privacyBanner}</span>
            </div>
            {timer.hasTiming&&<TimingDisplay timing={timer.timing} lang={lang} />}
            <AnonymousStats record={recordStats} scenario={scenario} pathway={pathway.map(p=>({nodeId:p.nodeId,variantId:p.variant.id}))} attempt={timer.startedAt} lang={lang} />
            <section className="space-y-2 print-norms"><h3 className="font-bold">{t.feedback.normsTitle}</h3><NormCards ids={pathway.flatMap(p => p.variant.normy)} scenario={scenario} lang={lang} onSelect={openNormModal} /></section>
            <button className="action" onClick={() => window.print()}>{copy.print}</button>
            <div className="pt-4 border-t border-obsidian-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={handleRestart}
                className="im-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm bg-obsidian-800 hover:bg-steel-700 text-white font-semibold text-xs transition-colors border border-steel-700"
              >
                <RotateCcw className="w-4 h-4 text-justice-gold" />
                {t.reflection.restartBtn}
              </button>

              <button
                onClick={handleExportScorm}
                disabled={isExportingScorm}
                className="im-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm bg-justice-gold hover:bg-justice-gold text-white font-semibold text-xs transition-colors shadow-md"
              >
                <Download className="w-4 h-4" />
                {isExportingScorm
                  ? ui(lang, 'm222')
                  : t.reflection.exportScormBtn}
              </button>
            </div>
          </div>
        </div>
      )}
      <CidsHelperModal
        isOpen={isCidsOpen}
        onClose={() => setIsCidsOpen(false)}
        lang={lang}
      />
      <NormDetailModal
        norm={activeNormDetail?.norm || null}
        yakZastosovuietsia={
          scenario.normy.find((n) => n.id === activeNormDetail?.norm.id)
            ?.yak_zastosovuietsia ?? activeNormDetail?.note
        }
        onClose={() => setActiveNormDetail(null)}
      />
    </div>
  );
};
