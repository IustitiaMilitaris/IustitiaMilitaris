import { useDiagramHeaderHeight } from '../hooks/useDiagramHeaderHeight';
import React, { useId, useState } from 'react';
import type { Scenario } from '../types';
import { variantLabel } from '../i18n/display';
import { useLanguage, ui } from '../i18n/ui';
import { choiceRect, diagram, horizontalCurve, layoutDecisionStages } from '../utils/decisionDiagram';
import { DecisionPathSvg } from './DecisionPathSvg';
import { DecisionStage, DiagramArrow } from './DecisionStage';

interface DecisionTreeSvgProps {
  scenario: Scenario;
  selectedPath?: { nodeId: string; variantId: string }[];
  currentNodeId?: string;
  visitedNodeIds?: string[];
  onSelectNode?: (nodeId: string) => void;
  unreachableNodeIds?: string[];
}

export const DecisionTreeSvg: React.FC<DecisionTreeSvgProps> = ({
  scenario, selectedPath, currentNodeId, visitedNodeIds = [], onSelectNode, unreachableNodeIds = []
}) => {
  const lang = useLanguage();
  const arrow = `tree-arrow-${useId().replace(/:/g, '')}`;
  const { svgRef, headerHeight } = useDiagramHeaderHeight(scenario, lang);
  const [hovered, setHovered] = useState<{ node: string; option?: number } | null>(null);
  if (selectedPath) return <DecisionPathSvg scenario={scenario} steps={selectedPath} />;
  if (!scenario.vuzly?.length) return <div className="p-8 text-center text-steel-400 text-sm">{ui(lang, 'm27')}</div>;
  const layout = layoutDecisionStages(scenario, headerHeight);
  const groups = scenario.vuzly.flatMap(node => {
    const targets = new Map<string, number[]>();
    node.varianty.forEach((v, index) => {
      if (!v.nastupnyi_vuzol || !layout.positions.has(v.nastupnyi_vuzol)) return;
      targets.set(v.nastupnyi_vuzol, [...(targets.get(v.nastupnyi_vuzol) || []), index]);
    });
    return [...targets].map(([to, options]) => ({ node, to, options }));
  });
  return <div className="decision-path-scroll w-full overflow-x-auto rounded-sm border border-steel-700 bg-obsidian-950/80 p-4" tabIndex={0} aria-label={lang === 'uk' ? 'Граф рішень' : 'Decision graph'}>
    <svg ref={svgRef} width={layout.width + 64} height={layout.height} className="block select-none" role="img" aria-label={lang === 'uk' ? 'Усі етапи та варіанти' : 'All stages and options'}>
      <defs><DiagramArrow id={arrow} color="#6BAEC4" size={5} /><DiagramArrow id={`${arrow}-active`} color="#C8A456" size={5} /></defs>
      {groups.map(({ node, to, options }) => {
        const from = layout.positions.get(node.id)!, target = layout.positions.get(to)!;
        const rects = options.map(index => choiceRect(from.x, from.top + headerHeight, index));
        const incoming = groups.filter(edge => edge.to === to).flatMap(edge => edge.options.map(option => ({ node: edge.node.id, option })));
        const active = node.id === currentNodeId ||
          (visitedNodeIds.includes(node.id) && visitedNodeIds.includes(to)) ||
          (hovered?.node === node.id && (hovered.option === undefined || options.includes(hovered.option)));
        const label = options.map(i => variantLabel(scenario, node.id, node.varianty[i].id, lang)).join(' · ');
        return <g key={`${node.id}:${to}`} data-testid="builder-edge" data-from={node.id} data-to={to} data-active={active}>
          {rects.map((rect, i) => {
            const routeActive = node.id === currentNodeId ||
              (visitedNodeIds.includes(node.id) && visitedNodeIds.includes(to)) ||
              (hovered?.node === node.id && (hovered.option === undefined || hovered.option === options[i]));
            const rank = incoming.findIndex(edge => edge.node === node.id && edge.option === options[i]);
            const end = { x: target.x, y: target.top + 4 + (rank + 0.5) / incoming.length * 64 };
            return <path key={options[i]} data-testid="builder-option-curve" data-active={routeActive} d={horizontalCurve({ x: rect.x + rect.width, y: rect.y + rect.height / 2 }, end)} stroke={routeActive ? '#C8A456' : '#6BAEC4'} strokeWidth={routeActive ? 2.5 : 1.5} fill="none" markerEnd={`url(#${routeActive ? `${arrow}-active` : arrow})`} />;
          })}
          <title>{label}</title>
        </g>;
      })}
      {scenario.vuzly.map(node => {
        const pos = layout.positions.get(node.id)!;
        return <g key={node.id} onMouseEnter={() => setHovered({ node: node.id })} onMouseLeave={() => setHovered(null)} data-testid="builder-stage" data-node-id={node.id} data-unreachable={!pos.reachable || unreachableNodeIds.includes(node.id)}>
          <DecisionStage graph onHoverOption={option => setHovered({ node: node.id, option })} scenario={scenario} node={node} lang={lang} x={pos.x} top={pos.top} headerHeight={headerHeight} active={node.id === currentNodeId} unreachable={!pos.reachable || unreachableNodeIds.includes(node.id)} onSelect={onSelectNode ? () => onSelectNode(node.id) : undefined} />
        </g>;
      })}
    </svg>
  </div>;
};
