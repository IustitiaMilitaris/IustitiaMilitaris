import React from 'react';
import type { Language } from '../i18n';
import type { Timing } from '../hooks/useScenarioTiming';
import { formatElapsed } from '../hooks/useScenarioTiming';
import labels from '../i18n/product.json';
export function TimingDisplay({ timing, lang }: { timing: Timing; lang: Language }) {
  const t=labels[lang];
  return <p className="text-sm text-steel-300" data-testid="timing-summary">{t.elapsed}: <span className="font-mono">{formatElapsed(timing.elapsedSeconds)}</span> · {timing.mode===10?t.ten:timing.mode===15?t.fifteen:t.unlimited}</p>;
}
