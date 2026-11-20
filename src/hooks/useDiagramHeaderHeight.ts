import { useLayoutEffect, useRef, useState } from 'react';
import { diagram } from '../utils/decisionDiagram';

export function useDiagramHeaderHeight(contentKey: unknown, language: string, stageKey = '') {
  const svgRef = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<{ headerHeight: number; headerBoxHeights: Record<string, number> }>({ headerHeight: diagram.header, headerBoxHeights: {} });

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const titles = [...svg.querySelectorAll<HTMLElement>('.diagram-stage-title')];
      const headerBoxHeights: Record<string, number> = {};
      const heights = titles.map(title => {
        const header = title.closest('foreignObject')!;
        const height = Math.ceil(title.getBoundingClientRect().bottom - header.getBoundingClientRect().top) + 10;
        headerBoxHeights[header.getAttribute('data-stage-id')!] = height;
        return height;
      });
      if (heights.length) {
        const headerHeight = Math.max(...heights) + 16;
        setLayout(previous => previous.headerHeight === headerHeight && JSON.stringify(previous.headerBoxHeights) === JSON.stringify(headerBoxHeights) ? previous : { headerHeight, headerBoxHeights });
      }
    };
    const observer = new ResizeObserver(measure);
    svg.querySelectorAll('.diagram-stage-title').forEach(title => observer.observe(title));
    measure();
    void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [contentKey, language, stageKey]);

  return { svgRef, ...layout };
}
