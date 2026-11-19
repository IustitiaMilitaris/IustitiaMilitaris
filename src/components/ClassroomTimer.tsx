import React, { useEffect, useState } from 'react';
import type { Language } from '../i18n';
export type TimerMode = 'none' | '10m' | '15m';
export const timerLabels = {
  uk: { mode: 'Режим часу', none: 'Без обмеження часу', '10m': '10 хв (Службовий тиск часу)', '15m': '15 хв (Стандарт кейсу)', waiting: 'Відлік почнеться з першого етапу', elapsed: 'Тривалість заняття', expired: 'Рекомендований час вичерпано — у реальній обстановці затримка рішення також має ціну. Ви можете завершити розбір без лічильника.' },
  en: { mode: 'Time mode', none: 'No time limit', '10m': '10 min (Operational time pressure)', '15m': '15 min (Standard case)', waiting: 'Timing starts at the first stage', elapsed: 'Session duration', expired: 'The recommended time has elapsed — in real situations, delaying a decision also has a cost. You can complete the discussion without the countdown.' }
};
export function ClassroomTimer({ room, offset, lang, embedded = false }: { room: { timerMode: TimerMode; timerDurationSec: number; timerStartedAt: number | null; timerFinishedAt: number | null }; offset: number; lang: Language; embedded?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(tick); }, []);
  const t = timerLabels[lang];
  const elapsed = room.timerStartedAt === null ? 0 : Math.max(0, Math.floor(((room.timerFinishedAt ?? now + offset) - room.timerStartedAt) / 1000));
  const remaining = Math.max(0, room.timerDurationSec - elapsed);
  const finished = room.timerFinishedAt !== null;
  const value = finished || !room.timerDurationSec ? elapsed : remaining;
  const format = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  return <section className={embedded ? "space-y-2" : "surface space-y-2"} data-testid="classroom-timer">
    {!embedded && <p className="text-sm">{t.mode}: {t[room.timerMode]}</p>}
    {room.timerStartedAt === null ? <p>{t.waiting}</p> : <p className={`tracker-clock text-center font-mono text-3xl sm:text-4xl font-bold tracking-wider ${!finished && room.timerDurationSec > 0 && remaining < 120 ? 'text-status-warning' : 'tracker-clock-normal'}`}>{finished && `${t.elapsed}: `}<span data-testid="classroom-clock">{format(value)}</span></p>}
    {!finished && room.timerStartedAt !== null && room.timerDurationSec > 0 && remaining === 0 && <p role="status" className="text-sm text-status-warning">{t.expired}</p>}
  </section>;
}
