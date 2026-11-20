import { PageMotion } from './components/PageMotion';
import polish from './i18n/polish.json';
import { caseLabel } from './i18n/display';
import designLabels from './i18n/design.json';
import accountLabels from './i18n/accounts.json';
import { localizeScenario } from './i18n/content';
import React, { useState, useEffect, useSyncExternalStore, lazy, Suspense } from 'react';
import { Scenario } from './types';
import { customMetadata, catalogReady, catalogRevision, subscribeCatalog, refreshCustomScenarios, allScenarios, teamScenarios } from './data/scenarios';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ScenarioCatalog } from './components/ScenarioCatalog';
import { SoloSimulator } from './components/SoloSimulator';
import { Language, translations } from './i18n';
import { LanguageContext } from './i18n/ui';

const Auth = lazy(() => import('./components/Auth').then(module => ({ default: module.Auth })));

const ClassroomFacilitator = lazy(() => import('./components/ClassroomFacilitator').then(module => ({ default: module.ClassroomFacilitator })));

const ClassroomStudent = lazy(() => import('./components/ClassroomStudent').then(module => ({ default: module.ClassroomStudent })));

const ScenarioBuilder = lazy(() => import('./components/ScenarioBuilder').then(module => ({ default: module.ScenarioBuilder })));

const NormsLibrary = lazy(() => import('./components/NormsLibrary').then(module => ({ default: module.NormsLibrary })));

export const App: React.FC = () => {
  useSyncExternalStore(subscribeCatalog, catalogRevision);
  useEffect(() => { void refreshCustomScenarios(); }, []);
  const [pathname, setPathname] = useState(window.location.pathname);
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setPathname(path);
  };
  useEffect(() => {
    const back = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  const currentView =
    pathname === '/'
      ? 'catalog'
      : /^\/scenarios\/S\d{2}(\/play|\/summary)?$/.test(pathname)
        ? 'solo'
        : pathname.startsWith('/classroom/join/')
          ? 'student'
          : pathname.startsWith('/classroom/host/')
            ? 'classroom'
            : pathname === '/classroom'
              ? 'student'
              : /^\/builder(\/S\d{2})?$/.test(pathname)
                ? 'builder'
                : pathname === '/norms'
                  ? 'norms'
                  : pathname === '/auth'
                    ? 'auth'
                    : 'missing';
  const setCurrentView = (view: string) =>
    navigate(
      (
        {
          catalog: '/',
          solo: `/scenarios/${allScenarios[0].id}`,
          classroom: '/classroom',
          student: '/classroom',
          builder: '/builder',
          norms: '/norms',
          auth: '/auth'
        } as Record<string, string>
      )[view] || '/'
    );
  const [customScenario, setActiveScenario] = useState<Scenario | null>(() => {
    try {
      return (
        JSON.parse(sessionStorage.getItem('builder-preview') || 'null') ||
        teamScenarios[0]
      );
    } catch {
      return teamScenarios[0];
    }
  });
  const studentRoomCode = pathname.split('/')[3] || '';
  const scenarioId = pathname.split('/')[2];
  const activeScenario =
    allScenarios.find((s) => s.id === scenarioId) || customScenario;
  const [lang, setLang] = useState<Language>(() => {
    try {
      return localStorage.getItem('eds-language') === 'en' ? 'en' : 'uk';
    } catch {
      return 'uk';
    }
  });

  useEffect(() => {
    // Check if URL has ?room=123456 for direct student phone join
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      navigate('/classroom/join/' + encodeURIComponent(roomParam));
    }

    // Register service worker for offline PWA
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translations[lang].appTitle;
    document
      .querySelector('meta[name=description]')
      ?.setAttribute('content', translations[lang].appSubtitle);
    try {
      localStorage.setItem('eds-language', lang);
    } catch {}
  }, [lang]);

  const handleStartSolo = (scenario: Scenario) => {
    setActiveScenario(scenario);
    navigate('/scenarios/' + scenario.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartClassroom = (scenario: Scenario) => {
    setActiveScenario(scenario);
    navigate('/classroom/host/new?scenario=' + scenario.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTestBuilderScenario = (scenario: Scenario) => {
    try {
      sessionStorage.setItem('builder-preview', JSON.stringify(scenario));
    } catch {}
    setActiveScenario(scenario);
    navigate('/scenarios/' + scenario.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!catalogReady) return <div role="status" className="page-shell">{polish[lang].loading}</div>;
  return (
    <LanguageContext.Provider value={lang}>
      <div className="min-h-screen flex flex-col bg-obsidian-950 text-steel-100 selection:bg-status-success selection:text-white">
        <Navbar
          onAuth={() => navigate('/auth')}
          currentView={
            currentView === 'student' || currentView === 'classroom'
              ? 'classroom'
              : currentView === 'missing'
                ? 'catalog'
                : currentView
          }
          setCurrentView={(view) => {
            setCurrentView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          lang={lang}
          setLang={setLang}
        />
        <main lang={lang} className="flex-1 relative z-10"><Suspense fallback={<div className="page-shell" role="status"><div className="steel-panel p-4 font-mono text-sm text-tactical-ice">{polish[lang].loading}</div></div>}>
          <PageMotion pathname={pathname} lang={lang}>
          {pathname !== '/' && (
            <nav
              id="breadcrumbs"
              aria-label={designLabels[lang].breadcrumbs}
              className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-2 text-xs text-steel-300"
            >
              <button
                className="text-steel-400 hover:text-steel-300"
                onClick={() => navigate('/')}
              >
                {designLabels[lang].catalog}
              </button>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="breadcrumb-current text-justice-gold">
                {currentView === 'solo'
                  ? `${caseLabel(scenarioId || '', lang)}: ${activeScenario ? localizeScenario(activeScenario,lang).nazva : ''}`
                  : currentView === 'auth'
                    ? designLabels[lang].account
                    : currentView === 'builder'
                      ? designLabels[lang].builder
                      : currentView === 'norms'
                        ? designLabels[lang].norms
                        : designLabels[lang].classroom}
              </span>
            </nav>
          )}
          {currentView === 'auth' && (
            <Auth lang={lang} onExit={() => navigate('/')} />
          )}
          {(currentView === 'missing' ||
            (currentView === 'solo' && activeScenario?.id !== scenarioId)) && (
            <section className="p-8">
              <h1>{accountLabels[lang].notFound}</h1>
              <button onClick={() => navigate('/')}>
                {accountLabels[lang].home}
              </button>
            </section>
          )}
          {currentView === 'catalog' && (
            <ScenarioCatalog
              onStartSolo={handleStartSolo}
              onStartClassroom={handleStartClassroom}
              lang={lang}
            />
          )}

          {currentView === 'solo' &&
            activeScenario &&
            activeScenario.id === scenarioId && (
              <SoloSimulator
                key={`${pathname}:${customMetadata[scenarioId]?.key || ''}`}
                scenario={localizeScenario(activeScenario, lang)}
                onBackToCatalog={() => setCurrentView('catalog')}
                lang={lang}
              />
            )}

          {currentView === 'classroom' && activeScenario && (
            <ClassroomFacilitator
              scenario={localizeScenario(
                currentView === 'classroom'
                  ? allScenarios.find(
                      (s) =>
                        s.id ===
                        new URLSearchParams(window.location.search).get(
                          'scenario'
                        )
                    ) || activeScenario
                  : activeScenario,
                lang
              )}
              onExit={() => setCurrentView('catalog')}
              lang={lang}
            />
          )}

          {currentView === 'student' && (
            <ClassroomStudent
              key={pathname}
              initialCode={studentRoomCode}
              onExit={() => setCurrentView('catalog')}
              lang={lang}
            />
          )}

          {currentView === 'builder' && (
            <ScenarioBuilder
              key={pathname}
              onTestScenario={handleTestBuilderScenario}
              lang={lang}
            />
          )}

          {currentView === 'norms' && <NormsLibrary lang={lang} />}
        </PageMotion></Suspense></main>
        <Footer lang={lang} />
      </div>
    </LanguageContext.Provider>
  );
};
