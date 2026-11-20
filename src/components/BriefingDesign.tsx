import { QuotedStageTitle } from './QuotedStageTitle';
import { HighlightedText } from './HighlightedText';
import { caseLabel, stageLabel } from '../i18n/display';
import React, { useLayoutEffect, useRef } from 'react';
import { Scale, Crosshair, Clock3 } from 'lucide-react';
import { Language, translations } from '../i18n';
import labels from '../i18n/design.json';
import type { Scenario } from '../types';
export function Dossier({
  scenario,
  lang,
  nodeId,
  index = 1,
  children
}: {
  scenario: Scenario;
  lang: Language;
  nodeId?: string;
  index?: number;
  children: React.ReactNode;
}) {
  const role = scenario.diiovi_osoby.find((r) => r.hravets);
  return (
    <section lang={lang} className="dossier hud-crosshair space-y-3" data-testid="dossier">
      {nodeId ? <StageStepper scenario={scenario} nodeId={nodeId} completed={index - 1} lang={lang} /> : <div className="flex flex-wrap items-center justify-center gap-2 w-full text-center">
        <span className="badge font-mono">
          {caseLabel(scenario.id, lang)} ·{' '}
          {nodeId
            ? stageLabel(scenario, nodeId, lang)
            : stageLabel(scenario, scenario.pochatkovyi_vuzol, lang)}
        </span>
        {role && (
          <span className="badge !text-justice-gold">
            {translations[lang].briefing.playerBadge}: {role.rol}
          </span>
        )}
      </div>}
      <div className="task-prose leading-relaxed">{typeof children === 'string' ? <HighlightedText text={nodeId && /^(Етап|Stage)\s*\d+/u.test(children) ? children.split('\n').slice(1).join('\n').trim() : children} /> : children}</div>
    </section>
  );
}
export function ValueConflict({
  a,
  b,
  explanation
}: {
  a: string;
  b: string;
  explanation: string;
}) {
  return (
    <div className="value-conflict space-y-3" data-testid="value-conflict">
      <div className="value-poles">
        <div className="value-pole">{a}</div>
        <Scale className="h-6 w-6 text-status-warning" aria-hidden="true" />
        <div className="value-pole">{b}</div>
      </div>
      <p className="task-prose value-explanation text-sm text-steel-300">{explanation}</p>
    </div>
  );
}
export function StageStepper({
  scenario,
  nodeId,
  completed,
  lang
}: {
  scenario: Scenario;
  nodeId: string;
  completed: number;
  lang: Language;
}) {
  const t = labels[lang];
  function depth(id: string, seen = new Set<string>()): number {
    if (seen.has(id)) return 0;
    const next = new Set(seen).add(id),
      node = scenario.vuzly.find((n) => n.id === id);
    return node
      ? 1 +
          Math.max(
            0,
            ...node.varianty.map((v) =>
              v.nastupnyi_vuzol ? depth(v.nastupnyi_vuzol, next) : 0
            )
          )
      : 0;
  }
  const containerRef=useRef<HTMLOListElement>(null);
  const activeStepRef=useRef<HTMLSpanElement>(null);
  useLayoutEffect(()=>{
    const container=containerRef.current,active=activeStepRef.current;if(!container||!active)return;
    const reveal=()=>{
      const left=active.getBoundingClientRect().left-container.getBoundingClientRect().left+container.scrollLeft;
      const right=left+active.offsetWidth;
      if(right>container.scrollLeft+container.clientWidth-8||left<container.scrollLeft+8){
        const target=Math.max(0,Math.min(left-8,right-container.clientWidth+8));
        container.scrollTo({left:target,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      }
    };
    reveal();const observer=new ResizeObserver(reveal);observer.observe(container);observer.observe(active);
    let alive=true;document.fonts.ready.then(()=>{if(alive)reveal();});
    return()=>{alive=false;observer.disconnect();};
  },[nodeId,completed,lang]);
  const total = Math.min(30, completed + depth(nodeId));
  const node = scenario.vuzly.find(n => n.id === nodeId);
  const heading = node?.tekst?.split('\n')[0] || '';
  const title = /^(Етап|Stage)\s*\d+\s*[·.:–—-]/u.test(heading) ? heading.replace(/^(Етап|Stage)\s*\d+\s*[·.:–—-]\s*/u, '') : node?.zapytannia || '';
  return (
    <ol ref={containerRef}
      className="progress-chain flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1"
      aria-label={t.stage}
      data-testid="stepper"
    >
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          aria-current={i === completed ? 'step' : undefined}
          className={`progress-chain-step flex items-center shrink-0 ${i > completed ? 'select-none' : ''}`}
        >
          {i > 0 && <span aria-hidden="true" className="w-2 sm:w-3 h-px bg-steel-700 mr-1.5 sm:mr-2 shrink-0" />}
          <span ref={i===completed?activeStepRef:undefined} className={`progress-chip ${i === completed ? 'is-current' : ''} inline-flex items-center justify-center px-2.5 py-1 rounded-sm border font-mono text-xs ${i === completed ? 'border-justice-gold bg-justice-gold/10 text-justice-gold font-bold' : i < completed ? 'border-tactical-ice/60 bg-tactical-ice/10 text-tactical-ice font-semibold' : 'opacity-[.35] blur-[0.4px] bg-obsidian-900/60 border-steel-700/50 text-steel-400'}`}>
            {i === completed ? <QuotedStageTitle text={`${i + 1} · ${title}`} /> : i + 1}
          </span>
        </li>
      ))}
    </ol>
  );
}
export function Consequence({
  delayed = false,
  title,
  children
}: {
  delayed?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  const Icon = delayed ? Clock3 : Crosshair;
  return (
    <section
      className={`surface-muted space-y-2 consequence ${delayed ? 'consequence-delayed' : ''}`}
    >
      <h3
        className={`im-section-title flex items-center gap-2 text-sm font-bold ${delayed ? 'text-status-warning' : 'text-tactical-ice'}`}
      >
        <Icon size={18} aria-hidden="true" />
        {title}
      </h3>
      <div className="feedback-prose text-sm leading-relaxed text-steel-100">{children}</div>
    </section>
  );
}
