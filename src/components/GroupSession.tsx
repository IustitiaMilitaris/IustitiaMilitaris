import { Layers } from 'lucide-react';
import { ScenarioIllustration } from './ScenarioIllustration';
import { ClassroomTimer, timerLabels, type TimerMode } from './ClassroomTimer';
import productLabels from '../i18n/product.json';
import { HighlightedText } from './HighlightedText';
import { NormChips } from './NormChips';
import { NormCards } from './NormCards';
import { AnimatedDetails } from './Collapsible';
import { caseLabel, stageLabel, optionLabel, variantLabel, choiceLabel, scenarioStageCount } from '../i18n/display';
import { CaseMetadata } from './CaseMetadata';
import {
  Dossier,
  ValueConflict,
  StageStepper,
  Consequence
} from './BriefingDesign';
import designLabels from '../i18n/design.json';
import { DecisionProfile } from './DecisionProfile';
import themes from '../i18n/themes.json';
import { CidsHelperModal } from './CidsHelperModal';
import { translations } from '../i18n';
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { allScenarios, normMap } from '../data/scenarios';
import { localizeScenario } from '../i18n/content';
import labels from '../i18n/group.json';
import type { Language } from '../i18n';
import type { Scenario } from '../types';
import { BalanceIndicators } from './BalanceIndicators';
import { NormDetailModal } from './NormDetailModal';

type State = {
  timerMode: TimerMode;
  timerDurationSec: number;
  timerStartedAt: number | null;
  timerFinishedAt: number | null;
  serverNow: number;
  code: string;
  scenarioId: string;
  currentNodeId: string;
  phase: string;
  showLive: boolean;
  selectedVariantId?: string;
  votes: Record<string, number>;
  totalVotes: number;
  participantsCount: number;
  discussionIndex: number;
  history: {
    nodeId: string;
    selectedVariantId: string;
    votes: Record<string, number>;
    discussionIndex: number;
  }[];
};
export function GroupSession({
  scenario: initialScenario,
  initialCode = '',
  lang,
  onExit,
  host = false
}: {
  scenario?: Scenario;
  initialCode?: string;
  lang: Language;
  onExit: () => void;
  host?: boolean;
}) {
  const t = labels[lang];
  const [inspected, setInspected] = useState<{node: string; variant: string} | null>(null);
  const [clockOffset, setClockOffset] = useState(0);

  const [cidsOpen, setCidsOpen] = useState(false);
  const [room, setRoom] = useState<State | null>(null);
  const [code, setCode] = useState(initialCode);
  const [joining, setJoining] = useState(Boolean(initialCode) || host);
  const [message, setMessage] = useState(
    initialCode || host ? 'connecting' : ''
  );
  const [chosenId, setChosenId] = useState('');
  const [voted, setVoted] = useState(false);
  const [qr, setQr] = useState('');
  const [link, setLink] = useState('');
  const [projector, setProjector] = useState(false);
  useEffect(() => {
    document.body.dataset.projector = String(projector);
    const exit = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProjector(false);
    };
    window.addEventListener('keydown', exit);
    return () => {
      delete document.body.dataset.projector;
      window.removeEventListener('keydown', exit);
    };
  }, [projector]);
  const [alias, setAlias] = useState<string|null>(null);
  useEffect(()=>{fetch('/api/auth/me').then(r=>r.ok?r.json():null).then(data=>setAlias(data?.user?.login||null)).catch(()=>{});},[]);
  const [norm, setNorm] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const activeCode = useRef(
    initialCode || window.location.pathname.split('/')[3]
  );
  useEffect(() => {
    if (!joining) return;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      const ws = new WebSocket(
        `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      );
      socket.current = ws;
      ws.onopen = () => {
        try {
          const existing = activeCode.current;
          let token = sessionStorage.getItem('clientVoteToken');
          if (!token) {
            token = Array.from(
              crypto.getRandomValues(new Uint8Array(24)),
              (x) => x.toString(16).padStart(2, '0')
            ).join('');
            sessionStorage.setItem('clientVoteToken', token);
          }
          if (host && (!existing || existing === 'new'))
            ws.send(
              JSON.stringify({
                type: 'CREATE_ROOM',
                timerMode: 'none',
                scenarioId: initialScenario?.id || allScenarios[0]?.id
              })
            );
          else {
            const secret = host
              ? sessionStorage.getItem('room-host-' + existing)
              : undefined;
            if (host && !secret) {
              setMessage('missing');
              return;
            }
            ws.send(
              JSON.stringify({
                type: 'JOIN_ROOM',
                roomCode: existing || code,
                hostSecret: secret,
                clientVoteToken: token
              })
            );
          }
        } catch {
          setMessage('missing');
        }
      };
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'ROOM_CREATED') {
          activeCode.current = data.room.code;
          sessionStorage.setItem(
            'room-host-' + data.room.code,
            data.hostSecret
          );
          history.replaceState({}, '', `/classroom/host/${data.room.code}`);
        }
        if (data.room) {
          setClockOffset(data.room.serverNow - Date.now());
          setRoom(data.room);
          setMessage('');
          setVoted(Boolean(data.hasVoted));
          try {
            setChosenId(
              sessionStorage.getItem(
                `room-vote-${data.room.code}-${data.room.currentNodeId}`
              ) || ''
            );
          } catch {}
        }
        if (data.type === 'ERROR') setMessage('missing');
        if (data.type === 'SESSION_CLOSED') {
          setRoom(null);
          setMessage('ended');
          stopped = true;
          ws.close();
        }
      };
      ws.onerror = () => setMessage('connecting');
      ws.onclose = () => {
        if (!stopped) {
          setMessage('connecting');
          retry = setTimeout(connect, 1500);
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [joining, host]);
  useEffect(() => {
    if (!room?.code || !host) return;
    let cancelled = false;
    fetch('/api/server-info')
      .then((r) => r.json())
      .then(async (info) => {
        const url = `${info.preferredOrigin}/classroom/join/${room.code}`;
        const image = await QRCode.toDataURL(url);
        if (!cancelled) {
          setLink(url);
          setQr(image);
        }
      })
      .catch(() => setLink(`${location.origin}/classroom/join/${room.code}`));
    return () => {
      cancelled = true;
    };
  }, [room?.code, host]);
  const source = allScenarios.find((s) => s.id === room?.scenarioId);
  const scenario = source ? localizeScenario(source, lang) : undefined;
  const node = scenario?.vuzly.find((n) => n.id === room?.currentNodeId);
  const variant = node?.varianty.find((v) => v.id === room?.selectedVariantId);
  const inspectedVariant = node?.varianty.find(v => v.id === (inspected?.node === node.id ? inspected.variant : room?.selectedVariantId)) || node?.varianty[0];
  const send = (type: string, variantId?: string, showLive?: boolean, timerMode?: TimerMode) => {
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify({ type, variantId, showLive, timerMode, ...(host ? { hostSecret: sessionStorage.getItem('room-host-' + activeCode.current) } : {}) }));
  };
  const totalVotes = (votes: Record<string, number>) =>
    Object.values(votes).reduce((a, b) => a + b, 0);
  const leader = node?.varianty.reduce(
    (best, v) =>
      (room?.votes[v.id] || 0) > (room?.votes[best.id] || 0) ? v : best,
    node.varianty[0]
  );
  function depth(id: string, visited = new Set<string>()): number {
    if (!scenario || visited.has(id)) return 0;
    const next = new Set(visited).add(id),
      n = scenario.vuzly.find((n) => n.id === id);
    return n
      ? 1 +
          Math.max(
            0,
            ...n.varianty.map((v) =>
              v.nastupnyi_vuzol ? depth(v.nastupnyi_vuzol, next) : 0
            )
          )
      : 0;
  }
  const chart = (
    votes: Record<string, number>,
    items: { id: string; tekst: string }[],
    selectable = false
  ) => (
    <div className="space-y-3" data-testid="vote-chart">
      {items.map((v) => {
        const count = votes[v.id] || 0,
          total = totalVotes(votes),
          percent = total ? Math.round((count / total) * 100) : 0;
        const selected =
          variant?.id === v.id || (!variant && leader?.id === v.id);
        return (
          <article
            className={`surface-muted space-y-3 ${selected ? '!border-justice-gold/40' : ''}`}
            key={v.id}
          >
            <div className="flex justify-between gap-3">
              <p className="text-sm">
                <strong className="text-justice-gold">
                  {optionLabel(
                    items.findIndex((item) => item.id === v.id),
                    lang
                  )}
                </strong>{' '}
                · {v.tekst}
              </p>
              <span className="badge shrink-0 font-mono">
                {percent}% · {count}
              </span>
            </div>
            <div className="meter">
              <div
                className="meter-fill"
                data-testid={`bar-${v.id}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            {selectable && host && (
              <button
                className={selected ? 'action-primary' : 'action'}
                onClick={() => send('DISCUSS', v.id)}
              >
                {t.discuss}{' '}
                {optionLabel(
                  items.findIndex((item) => item.id === v.id),
                  lang
                )}
                {v.id === leader?.id ? ` · ${t.leader}` : ''}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
  const scenarioCards = () => (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      data-testid="landing-team-grid"
    >
      {allScenarios.map((source) => {
        const s = localizeScenario(source, lang);
        return (
          <article
            key={s.id}
            className="classroom-card surface-muted h-full flex flex-col gap-4"
          >
            <div className="classroom-card-heading">
              <div className="card-top-meta mb-3">
                <div className="card-top-meta-tags"><span className="badge">{caseLabel(s.id, lang)}</span>
                <span className="badge">
                  {themes[lang][s.tema as keyof typeof themes.en] || s.tema}
                </span>
                </div><span className="card-top-meta-time text-steel-300">
                  <Layers aria-hidden="true" className="w-3.5 h-3.5" /> {scenarioStageCount(s)} {t.stages}
                </span>
              </div>
              <h4 className="im-scenario-title font-serif font-bold text-white leading-snug min-h-[3rem] sm:min-h-[3.25rem] mb-2">
                {s.nazva}
              </h4>
              <ScenarioIllustration id={s.id} title={s.nazva} lang={lang} />
            </div>
            <div className="mt-auto">
              <CaseMetadata scenario={s} lang={lang} />
            </div>
            <a
              className="action w-full whitespace-nowrap border-steel-700 text-steel-300 hover:border-steel-600 hover:text-steel-100"
              href={`/classroom/host/new?scenario=${s.id}`}
            >
              {t.host} →
            </a>
          </article>
        );
      })}
    </div>
  );
  return (
    <section
      className={`page-shell projector-session ${host && room?.phase === 'briefing' ? 'host-lobby' : ''} ${projector ? '!max-w-none sm:!px-12 text-lg' : ''}`}
    >
      {message && (
        <p className="notice" role="status">
          {t[message as keyof typeof t]}
        </p>
      )}
      {!joining && (
        <>
          <header>
            <h1 className="im-title font-serif text-2xl font-bold text-white">
              {t.title}
            </h1>
            <p className="mt-2 text-sm text-steel-300">{t.privacy}</p>
          </header>
          <div className="surface-muted text-sm">{alias?<p>{productLabels[lang].alias}: {alias} · {t.privacy}</p>:<a className="text-tactical-ice" href="/auth" onClick={()=>sessionStorage.setItem('auth-return','/classroom')}>{productLabels[lang].guest}</a>}</div>
          <form
            className="surface flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              activeCode.current = code;
              history.pushState({}, '', `/classroom/join/${code}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
              setJoining(true);
            }}
          >
            <div className="space-y-1">
              <h2 className="im-title font-serif text-xl font-bold">
                {t.participant}
              </h2>
              <p className="text-sm text-steel-300">{t.joinHint}</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
              <label className="block flex-1 sm:flex-none">
                <span className="sr-only">{t.code}</span>
                <input
                  className="im-field field h-12 py-2 text-lg text-center tracking-widest font-mono sm:w-48"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  placeholder={t.codePlaceholder}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </label>
              <button
                className="action-primary h-12 w-full sm:w-auto"
                disabled={!/^\d{6}$/.test(code)}
              >
                {t.join}
              </button>
            </div>
          </form>
          <div className="surface space-y-6">
            <h2 className="im-title font-serif text-xl font-bold">
              {t.hostTitle}
            </h2>

            <section className="space-y-3" aria-label={t.team}>
              <h3 className="im-section-title font-semibold text-steel-300">
                {t.team}
              </h3>
              {scenarioCards()}
            </section>
          </div>
        </>
      )}
      {room && !(host && room.phase === 'briefing') && <ClassroomTimer room={room} offset={clockOffset} lang={lang} />}
      {room && scenario && node && (
        <>
          <header className="surface flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="badge font-mono">
                  {t.code}: {room.code}
                </span>
                <span className="badge">
                  {t.participants}: {room.participantsCount}
                </span>
                <span className="badge">
                  {t.step}{' '}
                  {room.phase === 'finished'
                    ? room.history.length
                    : room.history.length + 1}{' '}
                  {t.of}{' '}
                  {room.phase === 'finished'
                    ? room.history.length
                    : room.history.length + depth(node.id)}
                </span>
              </div>
              <h1 className="im-title font-serif text-xl sm:text-2xl font-bold text-white">
                {scenario.nazva}
              </h1>
            </div>
            {host && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="action"
                  onClick={() => setProjector(!projector)}
                >
                  {projector ? designLabels[lang].exitProjector : t.projector}
                </button>
                <button
                  className="action-danger"
                  onClick={() => send('CLOSE_SESSION')}
                >
                  {t.close}
                </button>
              </div>
            )}
          </header>
          {host && link && (
            <div className="host-connection surface flex flex-wrap items-center gap-5">
              {qr && (
                <img
                  className="rounded-sm border border-steel-700"
                  src={qr}
                  alt={link}
                  width={144}
                  height={144}
                />
              )}
              <div className="connection-details space-y-3 flex-1">
                {room.phase === 'briefing' && <p className="font-mono text-2xl font-bold tracking-widest text-justice-gold my-2">{room.code}</p>}
                <a
                  className="block text-sm text-tactical-ice break-all"
                  href={link}
                >
                  {link}
                </a>
                <button
                  className="action"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      setCopied(true);
                    } catch {
                      const field = document.createElement('textarea');
                      field.value = link;
                      document.body.appendChild(field);
                      field.select();
                      try {
                        setCopied(document.execCommand('copy'));
                      } finally {
                        field.remove();
                      }
                    }
                  }}
                >
                  {copied ? t.copied : t.copy}
                </button>
              </div>
            </div>
          )}
          {room.phase === 'finished' ? (
            <div className="surface space-y-5 animate-fadeIn">
              <h2 className="im-title font-serif text-xl font-bold">
                {t.summary}
              </h2>
              <div className="w-full space-y-5">
                <div className="surface-muted space-y-3">
                  <h3 className="im-section-title font-semibold">{t.path}</h3>
                  <ol className="flex flex-wrap gap-2">
                    {room.history.map((h, i) => (
                      <li className="badge font-mono" key={i}>
                        {choiceLabel(
                          scenario,
                          h.nodeId,
                          h.selectedVariantId,
                          lang
                        )}{' '}
                        —{' '}
                        {
                          scenario.vuzly
                            .find((n) => n.id === h.nodeId)
                            ?.varianty.find((v) => v.id === h.selectedVariantId)
                            ?.tekst
                        }
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <p className="notice">
                {t.mostDivided}:{' '}
                {room.history
                  .filter(
                    (h) =>
                      h.discussionIndex ===
                      Math.max(...room.history.map((h) => h.discussionIndex))
                  )
                  .map((h) => stageLabel(scenario, h.nodeId, lang))
                  .join(', ')}
              </p>
              <DecisionProfile
                scenario={scenario}
                path={room.history.map((h) => ({
                  nodeId: h.nodeId,
                  variantId: h.selectedVariantId
                }))}
                lang={lang}
              />
              {room.history.map((h, i) => {
                const n = scenario.vuzly.find((n) => n.id === h.nodeId);
                return (
                  <AnimatedDetails className="surface-muted" key={i} open>
                    <summary className="cursor-pointer font-semibold">
                      {choiceLabel(
                        scenario,
                        h.nodeId,
                        h.selectedVariantId,
                        lang
                      )}{' '}
                      · {t.index}: {h.discussionIndex}
                    </summary>
                    <div className="mt-4">
                      {chart(h.votes, n?.varianty || [])}
                    </div>
                  </AnimatedDetails>
                );
              })}
              <section className="space-y-3"><h3 className="im-section-title font-bold">{translations[lang].feedback.normsTitle}</h3><NormCards ids={room.history.flatMap(h => scenario.vuzly.find(n => n.id === h.nodeId)?.varianty.find(v => v.id === h.selectedVariantId)?.normy || [])} scenario={scenario} lang={lang} onSelect={setNorm} /></section>
              <h3 className="im-section-title font-bold">
                {translations[lang].reflection.applicabilityTitle}
              </h3>
              <p>{scenario.zastosovnist}</p>
              <ul className="list-disc pl-5 space-y-2">
                {scenario.porady.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {room.phase === 'briefing' ? (
                <article className="surface space-y-5 animate-fadeIn">
                  <h2 className="im-title font-serif text-xl font-bold">
                    {translations[lang].briefing.title}
                  </h2>
                  <p className="text-steel-300 leading-relaxed">
                    <HighlightedText text={scenario.kontekst} />
                  </p>
                  <Dossier scenario={scenario} lang={lang}>
                    {scenario.sytuatsiia}
                  </Dossier>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {scenario.diiovi_osoby.map((r) => (
                      <div className="surface-muted" key={r.id}>
                        <h3 className="im-section-title font-bold text-justice-gold">
                          {r.rol}
                        </h3>
                        <p className="mt-2 text-sm text-steel-300">{r.opys}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {scenario.tsinnosti_v_konflikti.map((c, i) => (
                      <div className="surface-muted" key={i}>
                        <ValueConflict
                          a={c.tsinnist_a}
                          b={c.tsinnist_b}
                          explanation={c.poiasnennia}
                        />
                      </div>
                    ))}
                  </div>
                  {host ? (
                    <div className="lobby-time-controls w-full max-w-2xl mx-auto flex flex-col gap-3 items-center">
                      <fieldset data-testid="lobby-timer-selector" className="w-full min-w-0">
                        <legend className="text-sm mb-2 text-center w-full">{timerLabels[lang].mode}</legend>
                        <p className="text-center text-sm text-steel-300 mb-3">{lang === 'en' ? 'Timing starts synchronously when the first stage begins' : 'Відлік почнеться синхронно після запуску першого етапу'}</p>
                        <div data-testid="lobby-timer-options" className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
                          {(['none', '10m', '15m'] as const).map(mode => <button key={mode} type="button" aria-pressed={room.timerMode === mode} className="lobby-timer-option action w-full h-full" onClick={() => send('SET_TIMER_MODE', undefined, undefined, mode)}>{timerLabels[lang][mode]}</button>)}
                        </div>
                      </fieldset>
                      <button className="action-primary w-full py-3 flex items-center justify-center" data-testid="lobby-start" onClick={() => send('OPEN_VOTING')}>
                        {t.start}
                      </button>
                    </div>
                  ) : (
                    <p className="notice">{t.waiting}</p>
                  )}
                </article>
              ) : (
                <>
                  <article
                    className="surface space-y-4 animate-fadeIn"
                    key={node.id}
                  >
                    <span className="badge font-mono">
                      {stageLabel(scenario, node.id, lang)}
                    </span>
                    <h2 className="im-title font-serif text-xl font-bold text-white">
                      {node.zapytannia}
                    </h2>
                    <StageStepper
                      scenario={scenario}
                      nodeId={node.id}
                      completed={room.history.length}
                      lang={lang}
                    />
                    <Dossier
                      scenario={scenario}
                      lang={lang}
                      nodeId={node.id}
                      index={room.history.length + 1}
                    >
                      {node.tekst || scenario.sytuatsiia}
                    </Dossier>
                    <button
                      className="action"
                      onClick={() => setCidsOpen(true)}
                    >
                      {translations[lang].step.cidsHelperBtn}
                    </button>
                  </article>
                  {room.phase === 'voting' && (
                    <div className="surface space-y-5">
                      <div className="flex flex-wrap justify-between items-center gap-3">
                        <p className="font-semibold">
                          {t.participation}: {room.totalVotes} /{' '}
                          {room.participantsCount}
                        </p>
                        {host && (
                          <button
                            className="action"
                            onClick={() =>
                              send('SET_LIVE', undefined, !room.showLive)
                            }
                          >
                            {room.showLive ? t.hideLive : t.showLive}
                          </button>
                        )}
                      </div>
                      <div className="meter">
                        <div
                          className="meter-fill"
                          style={{
                            width: `${room.participantsCount ? Math.min(100, (room.totalVotes / room.participantsCount) * 100) : 0}%`
                          }}
                        />
                      </div>
                      {host ? (
                        room.showLive ? (
                          chart(room.votes, node.varianty)
                        ) : (
                          <p className="notice">{t.hidden}</p>
                        )
                      ) : voted ? (
                        <p className="notice" role="status">
                          {t.voted}{' '}
                          {chosenId && (
                            <strong className="font-mono">· {chosenId}</strong>
                          )}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {node.varianty.map((v) => (
                            <button
                              className="action w-full !justify-start !text-left !p-4"
                              key={v.id}
                              onClick={() => {
                                try {
                                  sessionStorage.setItem(
                                    `room-vote-${room.code}-${node.id}`,
                                    v.id
                                  );
                                } catch {}
                                setChosenId(v.id);
                                send('SUBMIT_VOTE', v.id);
                              }}
                            >
                              <span className="badge font-mono">
                                {variantLabel(scenario, node.id, v.id, lang)}
                              </span>
                              {v.tekst}
                            </button>
                          ))}
                        </div>
                      )}
                      {host && (
                        <button
                          className="action-primary"
                          onClick={() => send('SHOW_RESULTS')}
                        >
                          {t.results}
                        </button>
                      )}
                    </div>
                  )}
                  {['results', 'feedback'].includes(room.phase) && (
                    <div className="surface space-y-5">
                      <h2 className="im-title font-serif font-bold text-xl">
                        {t.results}
                      </h2>
                      <p className="notice">
                        {t.index}: <strong>{room.discussionIndex}</strong>
                        {room.discussionIndex >= 0.8 && (
                          <span className="badge ml-2 !text-status-warning">
                            {designLabels[lang].discussion}
                          </span>
                        )}
                      </p>
                      {chart(room.votes, node.varianty, true)}
                      <ul className="list-disc pl-5 space-y-2 text-sm text-steel-300">
                        {scenario.pytannia_dlia_obhovorennia.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {['results', 'feedback'].includes(room.phase) && inspectedVariant && (
                    <article
                      className="surface space-y-5 animate-fadeIn"
                      key={inspectedVariant.id}
                    >
                      <div role="tablist" aria-label={lang === 'en' ? 'Option explanations' : 'Розбір варіантів'} className="flex flex-wrap gap-2">
                        {node.varianty.map((item, index) => <button key={item.id} type="button" role="tab" aria-selected={inspectedVariant.id === item.id} className={inspectedVariant.id === item.id ? 'action-primary' : 'action'} onClick={() => setInspected({node: node.id, variant: item.id})}>
                          {optionLabel(index, lang)} · {room.totalVotes ? Math.round((room.votes[item.id] || 0) / room.totalVotes * 100) : 0}% {chosenId === item.id && (lang === 'en' ? '· Your choice' : '· Ваш вибір')}
                        </button>)}
                      </div>
                      <h2 className="im-title font-serif text-lg font-bold">
                        {variantLabel(scenario, node.id, inspectedVariant.id, lang)} ·{' '}
                        {inspectedVariant.tekst}
                      </h2>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Consequence title={t.immediate}>
                          {inspectedVariant.naslidky.odrazu}
                        </Consequence>
                        <Consequence delayed title={t.later}>
                          {inspectedVariant.naslidky.vidkladeni}
                        </Consequence>
                      </div>
                      <BalanceIndicators
                        scores={inspectedVariant.baly}
                        explanation={inspectedVariant.chomu_taki_baly}
                        lang={lang}
                      />
                      <p className="leading-relaxed text-steel-300">
                        {inspectedVariant.zvorotnyi_zviazok}
                      </p>
<NormChips ids={inspectedVariant.normy} lang={lang} onSelect={setNorm} />
                      {host && room.phase === 'feedback' && (
                        <button
                          className="action-primary"
                          onClick={() => send('NEXT_STAGE')}
                        >
                          {variant?.nastupnyi_vuzol
                            ? `${t.nextNode} →`
                            : t.finish}
                        </button>
                      )}
                    </article>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      <CidsHelperModal
        isOpen={cidsOpen}
        onClose={() => setCidsOpen(false)}
        lang={lang}
      />
      <NormDetailModal
        norm={norm ? normMap.get(norm) || null : null}
        yakZastosovuietsia={
          scenario?.normy.find((n) => n.id === norm)?.yak_zastosovuietsia
        }
        onClose={() => setNorm(null)}
      />
    </section>
  );
}
