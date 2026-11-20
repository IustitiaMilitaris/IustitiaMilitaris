import { QuotedStageTitle } from './QuotedStageTitle';
import React from 'react';
import type { Node, Scenario } from '../types';
import type { Language } from '../i18n';
import { stageLabel, variantLabel } from '../i18n/display';
import { choiceRect, diagram } from '../utils/decisionDiagram';

export function DiagramArrow({ id, color, size = 10 }: { id: string; color: string; size?: number }) {
  return <marker id={id} viewBox="0 0 10 10" refX="10" refY="5" markerWidth={size} markerHeight={size} markerUnits="userSpaceOnUse" orient="auto">
    <path d="M0 1 L10 5 L0 9Z" fill={color} />
  </marker>;
}

export function DecisionStage({ scenario, node, lang, x, top, selectedIndex, active, unreachable, onSelect, graph = false, onHoverOption, votes } : {
  scenario: Scenario; node: Node; lang: Language; x: number; top: number;
  votes?: Record<string,number>;
  selectedIndex?: number; active?: boolean; unreachable?: boolean; onSelect?: () => void; graph?: boolean; onHoverOption?: (index: number | undefined) => void;
}) {
  const heading = stageLabel(scenario, node.id, lang);
  const firstLine=node.tekst?.split('\n')[0] || '';
  const title = /^(Етап|Stage)\s*\d+\s*[·.:–—-]/u.test(firstLine) ? firstLine.replace(/^(Етап|Stage)\s*\d+\s*[·.:–—-]\s*/u,'') : heading.split(' · ').slice(1).join(' · ');
  const header = <><strong className="block text-left font-mono text-xs uppercase tracking-widest text-justice-gold">{stageLabel(scenario, node.id, lang, false)}</strong><span className="diagram-stage-title block mt-2 text-sm leading-snug"><QuotedStageTitle text={title} /></span></>;
  return <>
    {graph && <rect x={x} y={top} width={diagram.width} height={diagram.header - 12} rx={2} fill={active ? 'rgba(200,164,86,.13)' : 'var(--graph-surface)'} stroke={unreachable ? 'var(--graph-warning)' : active ? '#C8A456' : 'rgb(var(--slate-600))'} strokeDasharray={unreachable ? '4 2' : undefined} />}
    <foreignObject x={x} y={top} width={diagram.width} height={diagram.header - 8}>
      {onSelect ? <button type="button" data-testid="builder-stage-button" onClick={onSelect} title={heading} aria-pressed={!!active} className="diagram-stage-button w-full h-full text-left p-2 text-steel-100">{header}</button> : <div className="text-steel-100">{header}</div>}
    </foreignObject>
    {node.varianty.map((variant, index) => {
      const selected = selectedIndex === index;
      const count=votes?.[variant.id] || 0;
      const total=Object.values(votes || {}).reduce((a,b)=>a+b,0);
      const voted=count>0;
      const percentage=total?Math.round(count/total*100):0;
      const rect = choiceRect(x, top + diagram.header, index);
      const content = <><strong className="shrink-0 font-mono" style={{ color: selected ? 'rgb(var(--justice-gold))' : 'inherit' }}>{variantLabel(scenario, node.id, variant.id, lang)}</strong><span className="line-clamp-2">{variant.tekst}</span>{voted && <span data-testid="vote-percentage" className="shrink-0 font-mono text-[11px]">{percentage}%</span>}{selected && <span className="shrink-0" aria-label={lang === 'uk' ? 'Обрано' : 'Selected'}>✓</span>}</>;
      return <g key={variant.id} onMouseEnter={() => onHoverOption?.(index)} onMouseLeave={() => onHoverOption?.(undefined)} data-testid={graph ? 'builder-option' : 'path-option'} data-selected={selected} data-voted={voted} data-vote-count={count}>
        <rect {...rect} rx={2} fill={selected ? 'rgba(200,164,86,.13)' : voted ? 'rgba(107,174,196,.1)' : 'var(--graph-surface)'} stroke={selected ? '#C8A456' : voted ? '#6BAEC4' : 'rgb(var(--slate-600))'} />
        {selected && <rect x={rect.x} y={rect.y} width={3} height={rect.height} fill="#C8A456" />}
        {graph && variant.nastupnyi_vuzol === null && <g data-testid="terminal-marker"><circle cx={rect.x + rect.width + 10} cy={rect.y + rect.height / 2} r={3} fill="none" stroke="rgb(var(--slate-400))" /><text x={rect.x + rect.width + 18} y={rect.y + rect.height / 2 + 4} fill="var(--graph-ink)" fontSize={10}>{lang === 'uk' ? 'Фінал' : 'End'}</text></g>}
        <foreignObject x={rect.x + 10} y={rect.y + 10} width={rect.width - 20} height={rect.height - 20}>
          {onSelect ? <button type="button" onClick={onSelect} title={variant.tekst} className="diagram-stage-button flex items-start gap-2 w-full h-full text-left text-sm leading-snug" style={{ color: selected ? 'rgb(var(--justice-gold))' : voted ? 'rgb(var(--tactical-ice))' : 'var(--graph-ink)' }}>{content}</button> : <div title={variant.tekst} className="flex items-start gap-2 text-sm leading-snug" style={{ color: selected ? 'rgb(var(--justice-gold))' : voted ? 'rgb(var(--tactical-ice))' : 'var(--graph-ink)' }}>{content}</div>}
        </foreignObject>
      </g>;
    })}
  </>;
}
