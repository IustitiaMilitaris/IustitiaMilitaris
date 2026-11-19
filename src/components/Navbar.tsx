import { SlidingNav } from './SlidingNav';
import { Collapsible } from './Collapsible';
import { BrandLogo } from './BrandLogo';
import brandLabels from '../i18n/brand.json';
import React, { useEffect, useState } from 'react';
import { Sun, Moon, UserRound, ChevronDown } from 'lucide-react';
import { Language, translations } from '../i18n';
import labels from '../i18n/design.json';
interface NavbarProps {
  onAuth?: () => void;
  currentView: 'auth' | 'catalog' | 'solo' | 'auth' | 'classroom' | 'builder' | 'norms';
  setCurrentView: (
    view: 'catalog' | 'solo' | 'classroom' | 'builder' | 'norms'
  ) => void;
  lang: Language;
  setLang: (lang: Language) => void;
}
export const Navbar = ({
  currentView,
  setCurrentView,
  lang,
  setLang,
  onAuth
}: NavbarProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const t = labels[lang];
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('eds-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('eds-theme', theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const views = ['catalog', 'classroom', 'builder', 'norms'] as const;
  return (
    <header className="site-header sticky top-0 z-50 border-b border-steel-700 bg-obsidian-900/95 backdrop-blur-md">
      <div className="header-row">
        <a
          href="/"
          className="header-brand brand-trigger"
          aria-label={brandLabels[lang].home}
          onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            setCurrentView('catalog');
          }}
        >
          <BrandLogo />
          <span className="brand-wordmark">
            <span className="brand-name">IUSTITIA MILITARIS</span>
            <span className="brand-subtitle">{brandLabels[lang].short}</span>
          </span>
        </a>
        <SlidingNav className="header-nav desktop-navigation" label={translations[lang].appTitle} activeKey={currentView + lang}>
          {views.map((view) => (
            <button
              key={view}
              aria-current={
                currentView === view ||
                (currentView === 'solo' && view === 'catalog')
                  ? 'page'
                  : undefined
              }
              className={`header-tab ${currentView === view ? 'text-justice-gold border-justice-gold' : 'text-steel-300'}`}
              onClick={() => setCurrentView(view)}
            >
              {t[view]}
            </button>
          ))}
        </SlidingNav>
        <div className="header-tools">
          <button className="header-icon mobile-menu-trigger" aria-label={lang === 'uk' ? 'Меню навігації' : 'Navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}><ChevronDown strokeWidth={1.75} className={`w-4 h-4 shrink-0 collapse-chevron ${menuOpen ? 'is-open' : ''}`} /></button>
          <span
            className={`flex items-center gap-1 text-xs ${online ? 'network-online' : 'text-steel-400'}`}
            role="status"
            aria-label={online ? t.online : t.offline}
            title={online ? t.online : t.offline}
          >
            <span className="network-dot" aria-hidden="true" />
            <span className="hidden xl:inline">
              {online ? t.online : t.offline}
            </span>
          </span>
          <button
            className="header-icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? t.light : t.dark}
            title={theme === 'dark' ? t.light : t.dark}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button type="button" className={`language-toggle ${lang === 'en' ? 'is-english' : ''}`} aria-label={lang === 'uk' ? 'Мова: УКР. Перемкнути на ENG' : 'Language: ENG. Switch to UKR'} onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}>
            <span className="language-thumb" aria-hidden="true" /><span>УКР</span><span>ENG</span>
          </button>
          <button
            className="header-icon"
            onClick={onAuth}
            aria-label={t.account}
            title={t.account}
          >
            <UserRound size={18} />
          </button>
        </div>
      </div>
      <div className="mobile-navigation"><Collapsible isOpen={menuOpen} id="mobile-navigation"><SlidingNav activeKey={currentView + lang + menuOpen} className="flex flex-wrap gap-2 px-4 pb-3" label={lang === 'uk' ? 'Мобільна навігація' : 'Mobile navigation'}>{views.map(view => <button key={view} aria-current={currentView === view || currentView === 'solo' && view === 'catalog' ? 'page' : undefined} className="header-tab" onClick={() => {setCurrentView(view);setMenuOpen(false);}}>{t[view]}</button>)}</SlidingNav></Collapsible></div>
    </header>
  );
};
