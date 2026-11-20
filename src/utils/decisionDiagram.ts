import type { Scenario } from '../types';

export const diagram = { width: 280, gap: 112, header: 156, row: 88, box: 72, padding: 16 };
export type Point = { x: number; y: number };

export function choiceRect(x: number, top: number, index: number) {
  return { x, y: top + index * diagram.row, width: diagram.width, height: diagram.box };
}

export function horizontalCurve(from: Point, to: Point): string {
  const dx = Math.max(32, (to.x - from.x) * 0.5);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

export function layoutDecisionStages(scenario: Scenario, headerHeight = diagram.header) {
  const levels = new Map<string, number>();
  const nodes = new Map(scenario.vuzly.map(node => [node.id, node]));
  const queue = [{ id: scenario.pochatkovyi_vuzol, level: 0 }];
  for (let i = 0; i < queue.length; i++) {
    const { id, level } = queue[i];
    if (levels.has(id) || !nodes.has(id)) continue;
    levels.set(id, level);
    for (const option of nodes.get(id)!.varianty) {
      if (option.nastupnyi_vuzol) queue.push({ id: option.nastupnyi_vuzol, level: level + 1 });
    }
  }
  const last = Math.max(0, ...levels.values()) + 1;
  const positions = new Map<string, { x: number; top: number; reachable: boolean }>();
  const offsets = new Map<number, number>();
  for (const node of scenario.vuzly) {
    const level = levels.get(node.id) ?? last;
    const top = offsets.get(level) ?? 8;
    positions.set(node.id, { x: diagram.padding + level * (diagram.width + diagram.gap), top, reachable: levels.has(node.id) });
    offsets.set(level, top + headerHeight + node.varianty.length * diagram.row + 32);
  }
  return {
    positions,
    width: Math.max(320, ...[...positions.values()].map(p => p.x + diagram.width + diagram.padding)),
    height: Math.max(0, ...[...positions.entries()].map(([id, position]) => position.top + headerHeight + (nodes.get(id)!.varianty.length - 1) * diagram.row + diagram.box + diagram.padding))
  };
}
