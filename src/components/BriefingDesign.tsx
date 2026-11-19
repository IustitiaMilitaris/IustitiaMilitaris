import { HighlightedText } from './HighlightedText';
import { caseLabel, stageLabel } from '../i18n/display';
import React from 'react';
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
  const t = labels[lang],
    role = scenario.diiovi_osoby.find((r) => r.hravets);
  return (
    <section className="dossier hud-crosshair space-y-3" data-testid="dossier">
      <div className="flex flex-wrap gap-2">
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
      </div>
      <div className="leading-relaxed">{typeof children === 'string' ? <HighlightedText text={children} /> : children}</div>
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
    <div className="space-y-3" data-testid="value-conflict">
      <div className="value-poles">
        <div className="value-pole">{a}</div>
        <Scale className="h-6 w-6 text-status-warning" aria-hidden="true" />
        <div className="value-pole">{b}</div>
      </div>
      <p className="text-sm text-steel-300">{explanation}</p>
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
  const total = Math.min(30, completed + depth(nodeId));
  return (
    <ol
      className="flex flex-wrap gap-2"
      aria-label={t.stage}
      data-testid="stepper"
    >
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          aria-current={i === completed ? 'step' : undefined}
          className={`badge ${i === completed ? '!border-justice-gold !text-justice-gold' : ''}`}
        >
          <span>
            {i + 1}.{' '}
            {i < completed
              ? t.completed
              : i === completed
                ? t.current
                : t.upcoming}
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
      <div className="text-sm leading-relaxed text-steel-100">{children}</div>
    </section>
  );
}
