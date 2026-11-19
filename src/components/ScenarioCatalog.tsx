import { ScenarioIllustration } from './ScenarioIllustration';
import { caseLabel, scenarioStageCount } from '../i18n/display';
import { ScenarioDescription } from './ScenarioDescription';
import { CaseMetadata } from './CaseMetadata';
import { localizeScenario } from '../i18n/content';
import { ui } from '../i18n/ui';
import React, { useState } from 'react';
import {
  Play,
  Users,
  Download,
  Clock,
  Layers,
  Award,
  HelpCircle,
  Search
} from 'lucide-react';
import { Scenario } from '../types';
import { allScenarios, teamScenarios, normyData } from '../data/scenarios';
import { generateScorm12Zip } from '../utils/scormExport';
import { Language, translations } from '../i18n';

interface ScenarioCatalogProps {
  onStartSolo: (scenario: Scenario) => void;
  onStartClassroom: (scenario: Scenario) => void;
  lang: Language;
}

export const ScenarioCatalog: React.FC<ScenarioCatalogProps> = ({
  onStartSolo,
  onStartClassroom,
  lang
}) => {
  const t = translations[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filterScenarios = (list: Scenario[]) => {
    return list
      .map((s) => localizeScenario(s, lang))
      .filter((s) => {
        const matchesSearch =
          s.nazva.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.kontekst.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.audytoriia.some((a) =>
            a.toLowerCase().includes(searchQuery.toLowerCase())
          );

        const matchesTheme =
          selectedTheme === 'all' || s.tema === selectedTheme;
        return matchesSearch && matchesTheme;
      });
  };

  const handleExportScorm = async (scenario: Scenario) => {
    try {
      setDownloadingId(scenario.id);
      const zipBlob = await generateScorm12Zip(scenario, normyData, lang);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scenario.id}-scorm12.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('SCORM Export failed', err);
      alert(ui(lang, 'm181'));
    } finally {
      setDownloadingId(null);
    }
  };

  const getThemeLabel = (tema: string) => {
    const map: Record<string, string> = {
      podarunok: ui(lang, 'm182'),
      'konflikt-interesiv': ui(lang, 'm183'),
      vykryvach: ui(lang, 'm184'),
      'akademichna-dobrochesnist': ui(lang, 'm185'),
      'sluzhbove-maino': ui(lang, 'm186'),
      'kadrovi-rishennia': ui(lang, 'm187'),
      'neformalnyi-tysk': ui(lang, 'm188'),
      'rozpodil-resursiv': ui(lang, 'm189'),
      'pravdyvist-zvitiv': ui(lang, 'm190'),
      inshe: ui(lang, 'm191')
    };
    return map[tema] || tema;
  };

  const renderScenarioCard = (s: Scenario, isTeam: boolean) => {
    const stageCount = scenarioStageCount(s);

    return (
      <div
        key={s.id}
        className={`scenario-card steel-panel h-full flex flex-col rounded-sm bg-obsidian-850 border transition-all duration-200 hover:shadow-xl hover:border-tactical-ice/60 ${
          isTeam
            ? 'border-justice-gold/30 hover:border-justice-gold/60 shadow-justice-gold/20'
            : 'border-steel-700 hover:border-steel-600'
        }`}
      >
        <div className="scenario-card-content flex flex-1 flex-col p-5 sm:p-6 gap-0">
          <div className="scenario-card-description space-y-3.5">
            <div className="card-top-meta">
              <div className="card-top-meta-tags">
                <span
                  className={`im-tag font-mono text-xs font-bold px-2.5 py-1 rounded-sm border ${
                    isTeam
                      ? 'bg-justice-gold/20 text-justice-gold border-justice-gold/40'
                      : 'bg-obsidian-800 text-steel-300 border-steel-700'
                  }`}
                >
                  {caseLabel(s.id, lang)}
                </span>
                <span className="im-tag text-xs px-2.5 py-1 rounded-sm bg-obsidian-850 text-tactical-ice border border-tactical-ice/20 font-medium">
                  {getThemeLabel(s.tema)}
                </span>
              </div>

              <div className="card-top-meta-time text-steel-300">
                <Clock aria-hidden="true" />
                <span>{s.tryvalist_khv} {t.catalog.minutes} · {stageCount} {t.catalog.stagesCount}</span>
              </div>
            </div>
            <div className="scenario-card-copy">
              <h3 className="scenario-card-title font-serif text-lg sm:text-xl font-bold text-steel-100 min-h-[3.25rem] sm:min-h-[3.5rem] flex items-start leading-snug">
                {s.nazva}
              </h3>
              <ScenarioIllustration id={s.id} title={s.nazva} lang={lang} />
              <ScenarioDescription text={s.sytuatsiia} lang={lang} truncate={s.id !== 'S02' && !(s.id === 'S01' && lang === 'en')} />
            </div>
          </div>
          <div className="scenario-card-metadata mt-3 pt-3 border-t border-steel-700/30 space-y-2">
            <CaseMetadata scenario={s} lang={lang} />
            <div className="text-[11px] text-steel-300">
              <span className="text-steel-300 font-semibold">
                {t.catalog.audience}:{' '}
              </span>
              <span className="">{s.audytoriia.join(', ')}</span>
            </div>
          </div>
        </div>
        <div className="p-4 bg-obsidian-950/70 border-t border-obsidian-800/80 rounded-sm flex flex-col">
          <button
            onClick={() => onStartSolo(s)}
            className="im-primary w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-sm bg-justice-gold hover:bg-justice-gold text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {t.catalog.startSolo}
          </button>
          <div className="scenario-secondary-actions grid grid-cols-[minmax(0,1fr)_max-content] gap-2 mt-2 w-full">
            <button
              onClick={() => onStartClassroom(s)}
              className="im-secondary w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm bg-obsidian-800 hover:bg-obsidian-850 text-steel-300 hover:text-steel-100 border border-steel-700 hover:border-steel-600 font-medium text-xs transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              {t.catalog.startClassroom}
            </button>
            <button
              onClick={() => handleExportScorm(s)}
              disabled={downloadingId === s.id}
              className="im-secondary w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-sm bg-obsidian-800 hover:bg-obsidian-850 text-steel-300 hover:text-steel-100 border border-steel-700 hover:border-steel-600 text-[11px] font-medium transition-colors"
              title={ui(lang, 'm195')}
            >
              <Download className="w-3.5 h-3.5" />
              {downloadingId === s.id ? ui(lang, 'm196') : 'SCORM 1.2'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const filteredTeam = filterScenarios(teamScenarios);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-sm bg-obsidian-850/80 border border-steel-700 text-steel-300 font-mono text-xs">
          <Award className="w-4 h-4" />
          {ui(lang, 'm197')}{' '}
        </div>
        <h1 className="im-title font-serif text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          {t.appTitle}
        </h1>
        <p className="text-sm sm:text-base text-steel-300 leading-relaxed">
          {t.appSubtitle}
          {ui(lang, 'm198')}{' '}
        </p>
      </div>
      <div className="steel-panel p-4 rounded-sm bg-obsidian-850 border border-obsidian-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-steel-300 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={ui(lang, 'm199')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm pl-9 pr-4 py-2 text-xs text-white placeholder-steel-300 focus:outline-none focus:border-justice-gold"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 text-xs">
          <span className="text-steel-300 text-xs shrink-0">
            {t.catalog.theme}:
          </span>
          <select
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
            className="im-field bg-obsidian-950 border border-steel-700 text-steel-100 rounded-sm px-3 py-1.5 focus:outline-none focus:border-justice-gold text-xs"
          >
            <option value="all">{ui(lang, 'm200')} </option>
            <option value="vykryvach">{ui(lang, 'm201')} </option>
            <option value="sluzhbove-maino">{ui(lang, 'm202')} </option>
            <option value="kadrovi-rishennia">{ui(lang, 'm203')} </option>
            <option value="podarunok">{ui(lang, 'm204')} </option>
            <option value="konflikt-interesiv">{ui(lang, 'm205')} </option>
            <option value="akademichna-dobrochesnist">
              {ui(lang, 'm206')}{' '}
            </option>
          </select>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-justice-gold/30 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="im-title font-serif text-lg sm:text-xl font-bold text-white flex flex-wrap items-center gap-2">
                <Award className="w-5 h-5 text-justice-gold" />
                {t.catalog.teamScenariosTitle}
              </h2>
              <span className="im-tag px-2 py-0.5 rounded-sm text-[11px] font-bold bg-tactical-ice/10 text-tactical-ice border border-tactical-ice/30 font-mono">
                {allScenarios.length}{' '}
              </span>
            </div>
            <p className="text-xs text-steel-300 mt-1">
              {t.catalog.teamScenariosDesc}
            </p>
          </div>
          <span className="text-xs text-steel-300 font-mono">
            {filteredTeam.length} {ui(lang, 'm208')} {teamScenarios.length}
          </span>
        </div>

        {filteredTeam.length === 0 ? (
          <div className="steel-panel p-8 text-center text-steel-400 bg-obsidian-850 rounded-sm border border-obsidian-800 text-sm">
            {ui(lang, 'm209')}{' '}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTeam.map((s) => renderScenarioCard(s, true))}
          </div>
        )}
      </div>
    </div>
  );
};
