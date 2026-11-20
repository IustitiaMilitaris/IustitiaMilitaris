import { TimingDisplay } from './TimingDisplay';
import { ProfileDecisionPath } from './ProfileDecisionPath';
import { caseLabel } from '../i18n/display';
import { allScenarios } from '../data/scenarios';
import { localizeScenario } from '../i18n/content';
import { DecisionProfile, resolvePath } from './DecisionProfile';
import { translations } from '../i18n';
import themes from '../i18n/themes.json';
import React, { useEffect, useState } from 'react';
import labels from '../i18n/accounts.json';
import type { Language } from '../i18n';
export function Auth({ lang, onExit }: { lang: Language; onExit: () => void }) {
  const t = labels[lang];
  const [register, setRegister] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [user, setUser] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<
    Record<
      string,
      {
        pathway: { nodeId: string; variantId: string }[];
        notes: string;
        timing?: {mode:number;elapsedSeconds:number};
        updatedAt?: string;
        completedAt?: string;
      }
    >
  >({});
  async function load() {
    const r = await fetch('/api/auth/me');
    if (!r.ok) throw Error();
    const data = await r.json();
    setUser(data.user?.login || null);
    if (data.user) {
      const response = await fetch('/api/progress');
      if (!response.ok) throw Error();
      setProgress(await response.json());
    }
  }
  useEffect(() => {
    load().catch(() => setError('serverError'));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (register && password !== confirm) {
      setError('mismatch');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
      });
      const data = await r.json();
      if (!r.ok) setError(data.error);
      else {
        setPassword('');
        setConfirm('');
        await load();
        if (sessionStorage.getItem('auth-return') === '/classroom') { sessionStorage.removeItem('auth-return'); window.location.assign('/classroom'); }
      }
    } catch {
      setError('serverError');
    } finally {
      setBusy(false);
    }
  }
  const records = Object.entries(progress).flatMap(([id, entry]) => {
    if(!id.includes('::') && progress[`${id}::none`])return [];
    const source = allScenarios.find((s) => s.id === id.split('::')[0]);
    if (!source) return [];
    const scenario = localizeScenario(source, lang),
      steps = resolvePath(scenario, entry.pathway);
    const complete =
      steps.length > 0 &&
      steps[steps.length - 1].variant.nastupnyi_vuzol === null;
    return [{ id, entry, scenario, steps, complete }];
  });
  const latestRecordId = [...records].sort((a, b) =>
    (Date.parse(a.entry.completedAt || a.entry.updatedAt || '') || 0) -
    (Date.parse(b.entry.completedAt || b.entry.updatedAt || '') || 0)
  ).slice(-1)[0]?.id;
  const completed = records.filter((r) => r.complete);
  const recent = records
    .map((r) => r.entry.completedAt || r.entry.updatedAt)
    .filter((date): date is string => Boolean(date))
    .sort()
    .slice(-1)[0];
  const date = (value?: string) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'uk-UA', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(new Date(value))
      : t.unknownDate;
  return (
    <section className={`page-shell ${user ? '' : '!max-w-xl'}`}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user && (
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border border-status-success/30 bg-status-success/10 text-xl font-bold text-status-success"
              aria-hidden="true"
            >
              {user.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="im-title font-serif text-2xl font-bold text-white">
              {user || t.title}
            </h1>
            {user && <span className="badge mt-2">{t.localBadge}</span>}
          </div>
        </div>
        {user && (
          <div className="flex flex-wrap gap-2">
            <button
              className="action-ghost"
              onClick={async () => {
                try {
                  const response = await fetch('/api/auth/logout', {
                    method: 'POST'
                  });
                  if (!response.ok) throw Error();
                  setUser(null);
                  setProgress({});
                  setError('');
                } catch {
                  setError('serverError');
                }
              }}
            >
              {t.logout}
            </button>
          </div>
        )}
      </header>
      {error && (
        <p className="notice" role="status">
          {t[error as keyof typeof t] || t.serverError}
        </p>
      )}
      {user ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [
                t.completedCount,
                `${new Set(completed.map(r=>r.scenario.id)).size} / ${allScenarios.length}`
              ],
              [t.teamCount, `${new Set(completed.map(r=>r.scenario.id)).size} / ${allScenarios.length}`],
              [t.lastPlayed, date(recent)]
            ].map(([label, value]) => (
              <div className="surface space-y-3" key={label}>
                <p className="text-sm text-steel-300">{label}</p>
                <p className="text-xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
          <h2 className="im-title font-serif text-xl font-bold">
            {t.progress}
          </h2>
          {!records.length && <p className="surface">{t.empty}</p>}
          {records.map(({ id, entry, scenario, steps, complete }) => (
            <article key={id} className="surface min-w-0 space-y-5" data-testid="profile-case" data-scenario-id={scenario.id}>
              <header className="flex flex-wrap justify-between items-start gap-3">
                <div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="badge">{caseLabel(scenario.id, lang)}</span><span className="badge">{id.endsWith('::10m')?'10':id.endsWith('::15m')?'15':(lang==='uk'?'Без часу':'Untimed')}{/::(10|15)m$/.test(id)?(lang==='uk'?' хв':' min'):''}</span>
                    <span className="badge">
                      {themes[lang][scenario.tema as keyof typeof themes.en] ||
                        scenario.tema}
                    </span>
                    <span
                      className={`badge ${complete ? '!border-status-success/30 !text-status-success' : '!text-status-warning'}`}
                    >
                      {complete ? t.completed : t.inProgress}
                    </span>
                  </div>
                  <h3 className="im-scenario-title font-serif text-lg font-bold text-white">
                    {scenario.nazva}
                  </h3>
                </div>
                <time
                  className="text-xs text-steel-300"
                  dateTime={entry.completedAt || entry.updatedAt}
                >
                  {date(entry.completedAt || entry.updatedAt)}
                </time>
              </header>
              {entry.timing&&<TimingDisplay timing={entry.timing} lang={lang} />}
              <ProfileDecisionPath scenario={scenario} path={entry.pathway} lang={lang} open={id === latestRecordId} />
              <DecisionProfile
                scenario={scenario}
                path={entry.pathway}
                lang={lang}
              />
              <p className="text-xs text-steel-300">
                {translations[lang].reflection.profileNotice}
              </p>
              <label className="block space-y-2 text-sm font-medium">
                {t.notes}
                <textarea
                  className="im-field field mt-2 min-h-28"
                  maxLength={4000}
                  value={entry.notes}
                  onChange={(e) => {
                    setSavedId(null);
                    setProgress({
                      ...progress,
                      [id]: { ...entry, notes: e.target.value }
                    });
                  }}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  className="action-primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const response = await fetch('/api/progress', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          scenarioId: scenario.id, timerMode: id.split('::')[1] || 'none',
                          pathway: entry.pathway,
                          notes: entry.notes
                        })
                      });
                      if (!response.ok) throw Error();
                      setError('');
                      setSavedId(id);
                    } catch {
                      setError('serverError');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? t.saving : t.save}
                </button>
                {savedId === id && (
                  <span
                    className="self-center text-sm text-status-success"
                    role="status"
                  >
                    {t.saved}
                  </span>
                )}
                <button
                  className="action"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/progress', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ scenarioId: scenario.id, timerMode: id.split('::')[1] || 'none', pathway: [] })
                      });
                      if (!response.ok) throw Error();
                      window.location.assign(`/scenarios/${scenario.id}?mode=${id.split('::')[1] || 'none'}`);
                    } catch {
                      setError('serverError');
                    }
                  }}
                >
                  {t.replay}
                </button>
              </div>
            </article>
          ))}
        </>
      ) : (
        <div className="surface space-y-5">
          <div
            className="grid grid-cols-2 gap-2 rounded-sm bg-obsidian-950 p-1"
            role="tablist"
            aria-label={t.title}
          >
            {[false, true].map((mode) => (
              <button
                key={String(mode)}
                role="tab"
                aria-selected={register === mode}
                className={
                  register === mode ? 'action-primary' : 'action-ghost'
                }
                onClick={() => {
                  setRegister(mode);
                  setError('');
                }}
              >
                {mode ? t.register : t.login}
              </button>
            ))}
          </div>
          <p className="notice">{t.notice}</p>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">
              {t.alias}
              <input
                className="im-field field mt-2"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                pattern="[a-zA-Z0-9_-]{3,32}"
              />
            </label>
            <label className="block text-sm font-medium">
              {t.password}
              <input
                className="im-field field mt-2"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                minLength={6}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {register && (
              <label className="block text-sm font-medium">
                {t.confirm}
                <input
                  className="im-field field mt-2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </label>
            )}
            <button className="action-primary w-full" disabled={busy}>
              {register ? t.register : t.login}
            </button>
          </form>
          <button className="action w-full" onClick={onExit}>
            {t.guest}
          </button>
        </div>
      )}
    </section>
  );
}
