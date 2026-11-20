import { useLayoutEffect, useRef, useState } from 'react';
import { diagram } from '../utils/decisionDiagram';

export function useDiagramHeaderHeight(contentKey: unknown, language: string, stageKey = '') {
  const svgRef = useRef<SVGSVGElement>(null);
  const [headerHeight, setHeaderHeight] = useState(diagram.header);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const titles = [...svg.querySelectorAll<HTMLElement>('.diagram-stage-title')];
      const heights = titles.map(title => {
        const header = title.closest('foreignObject')!;
        return title.getBoundingClientRect().bottom - header.getBoundingClientRect().top;
      });
      if (heights.length) setHeaderHeight(Math.ceil(Math.max(...heights)) + 26);
    };
    const observer = new ResizeObserver(measure);
    svg.querySelectorAll('.diagram-stage-title').forEach(title => observer.observe(title));
    measure();
    void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [contentKey, language, stageKey]);

  return { svgRef, headerHeight };
}
