import { useEffect, useState } from 'react';
export type Timing = { mode: number; elapsedSeconds: number };
export function useScenarioTiming(id: string, phase: string, initialMode = 0) {
  const key = `simulator_timing_${id}`;
  const [clock, setClock] = useState<{mode:number; startedAt:number; elapsedSeconds:number; completed:boolean; known?:boolean}>(() => {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); if (value && [0,10,15].includes(value.mode) && Number.isFinite(value.startedAt) && Number.isFinite(value.elapsedSeconds)) return value; } catch {}
    return { mode:initialMode, startedAt:0, elapsedSeconds:0, completed:false };
  });
  const active = phase === 'decision' || phase === 'feedback';
  useEffect(() => {
    if (!active || clock.completed) return;
    if (!clock.startedAt) { setClock(c => ({...c,startedAt:Date.now()})); return; }
    const tick = () => setClock(c => ({...c,elapsedSeconds:Math.min(31536000,Math.max(0,Math.floor((Date.now()-c.startedAt)/1000)))}));
    tick(); const interval = window.setInterval(tick,1000); return () => clearInterval(interval);
  }, [active, clock.startedAt, clock.completed]);
  useEffect(() => {
    if (phase === 'reflection' && clock.startedAt && !clock.completed) setClock(c => ({...c,completed:true,elapsedSeconds:Math.max(c.elapsedSeconds,Math.min(31536000,Math.floor((Date.now()-c.startedAt)/1000)))}));
  }, [phase,clock.startedAt,clock.completed]);
  useEffect(() => { try {localStorage.setItem(key,JSON.stringify(clock));} catch {} }, [key,clock]);
  const start = () => { const next={...clock,startedAt:Date.now(),elapsedSeconds:0,completed:false,known:true}; try{localStorage.setItem(key,JSON.stringify(next));}catch{} setClock(next); };
  const reset = () => setClock({mode:initialMode,startedAt:0,elapsedSeconds:0,completed:false});
  return { ...clock, hasTiming:clock.startedAt>0||(clock.completed&&clock.known!==false), restore:(timing:Timing|undefined,completed:boolean)=>setClock(timing?{mode:timing.mode,elapsedSeconds:timing.elapsedSeconds,startedAt:completed?0:Date.now()-timing.elapsedSeconds*1000,completed,known:true}:{mode:0,elapsedSeconds:0,startedAt:0,completed,known:false}), setMode:(mode:number) => setClock(c => ({...c,mode})), start, reset, timing:{mode:clock.mode,elapsedSeconds:clock.elapsedSeconds} };
}
export function formatElapsed(seconds: number) {
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
