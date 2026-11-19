import React, { useId } from 'react';
import type { Scenario } from '../types';
import { useLanguage } from '../i18n/ui';
import { choiceRect, diagram, horizontalCurve } from '../utils/decisionDiagram';
import { DecisionStage, DiagramArrow } from './DecisionStage';

type Step = { nodeId: string; variantId: string };
export function DecisionPathSvg({ scenario, steps, votesByNode }: { scenario: Scenario; steps: Step[]; votesByNode?: Record<string,Record<string,number>> }) {
  const lang = useLanguage();
  const arrow = `path-arrow-${useId().replace(/:/g, '')}`;
  const columns = steps.flatMap(step => {
    const node = scenario.vuzly.find(n => n.id === step.nodeId);
    const index = node?.varianty.findIndex(v => v.id === step.variantId) ?? -1;
    return node && index >= 0 ? [{ node, index }] : [];
  });
  const top = 8;
  const height = top + diagram.header + Math.max(1, ...columns.map(c => c.node.varianty.length)) * diagram.row + 20;
  const totalWidth = Math.max(300, columns.length * (diagram.width + diagram.gap) - diagram.gap + diagram.padding * 2);
  return <div className="decision-path-scroll w-full overflow-x-auto rounded-sm border border-steel-700 bg-obsidian-950/80 p-4" tabIndex={0} aria-label={votesByNode ? (lang==='uk'?'Маршрут рішень групи':'Group decision pathway') : (lang === 'uk' ? 'Ваш шлях прийняття рішень' : 'Your decision pathway')}>
    <svg width={totalWidth} height={height} className="block select-none" role="img" aria-label={lang === 'uk' ? 'Пройдені етапи та обрані варіанти' : 'Completed stages and selected options'}>
      <defs><DiagramArrow id={arrow} color="#C8A456" /></defs>
      {columns.slice(1).map((column, i) => {
        const previous = columns[i];
        const from = choiceRect(diagram.padding + i * (diagram.width + diagram.gap), top + diagram.header, previous.index);
        const to = choiceRect(diagram.padding + (i + 1) * (diagram.width + diagram.gap), top + diagram.header, column.index);
        const curve = horizontalCurve({ x: from.x + from.width, y: from.y + from.height / 2 }, { x: to.x, y: to.y + to.height / 2 });
        return <path key={i} data-testid="selected-curve" data-from-option={previous.index} data-to-option={column.index} d={curve} stroke="#C8A456" strokeWidth="2.5" fill="none" markerEnd={`url(#${arrow})`} />;
      })}
      {columns.map(({ node, index }, col) => <g key={`${col}:${node.id}`} data-testid="path-stage">
        <DecisionStage scenario={scenario} node={node} lang={lang} x={diagram.padding + col * (diagram.width + diagram.gap)} top={top} selectedIndex={index} votes={votesByNode?.[node.id]} />
      </g>)}
    </svg>
  </div>;
}
