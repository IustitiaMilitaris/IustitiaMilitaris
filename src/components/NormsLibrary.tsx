import { AnimatedDetails } from './Collapsible';
import { normHierarchy } from '../utils/normHierarchy';
import product from '../i18n/product.json';
import { formatNormBadge, formatNormDisplayId } from '../i18n/normDisplay';
import polish from '../i18n/polish.json';
import { caseLabel } from '../i18n/display';
import { localizeNorms } from '../i18n/content';
import { ui } from '../i18n/ui';
import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { normyData as originalNorms, allScenarios } from '../data/scenarios';
import { NormEntry } from '../types';
import { NormDetailModal } from './NormDetailModal';
import { Language, translations } from '../i18n';

interface NormsLibraryProps {
  lang: Language;
}

export const NormsLibrary: React.FC<NormsLibraryProps> = ({ lang }) => {
  const normyData = localizeNorms(originalNorms, lang);
  const t = translations[lang];
  const copy = polish[lang];
  const [category, setCategory] = useState('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeNorm, setActiveNorm] = useState<NormEntry | null>(null);

  // Map norm id to scenarios that use it
  const usageMap: Record<string, string[]> = {};
  for (const s of allScenarios) {
    for (const n of s.normy || []) {
      if (!usageMap[n.id]) usageMap[n.id] = [];
      if (!usageMap[n.id].includes(s.id)) {
        usageMap[n.id].push(s.id);
      }
    }
  }

  const filteredNorms = normyData.normy
    .filter((n) => {
      const matchesSearch =
        n.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.akt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.punkt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.korotko.toLowerCase().includes(searchQuery.toLowerCase()) || n.tsytaty.join(' ').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'verified' ? n.status_zvirky !== 'ne-zvireno' : n.status_zvirky === 'ne-zvireno');
      const type = n.typ === 'sudova-praktyka' || n.id.startsWith('VS-') ? 'courts' : n.id.startsWith('KONST-') ? 'constitution' : ['zakon','kodeks','postanova'].includes(n.typ) ? 'laws' : 'international';
      return matchesSearch && matchesStatus && (category === 'all' || category === type);
    })
    .sort((a, b) => a.akt.localeCompare(b.akt));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="steel-panel p-6 rounded-sm bg-obsidian-850 border border-steel-700 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="p-2 rounded-sm bg-tactical-ice/20 text-tactical-ice border border-tactical-ice/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="im-title font-serif text-xl sm:text-2xl font-bold text-white">
              {normyData.nazva}
            </h1>
          </div>
          <p className="text-xs text-steel-300 mt-1 max-w-2xl leading-relaxed">
            {normyData.prymitka}
          </p>
        </div>

        <div className="text-xs font-mono text-tactical-ice px-3 py-1.5 rounded-sm bg-obsidian-800 border border-steel-700 shrink-0">
          {ui(lang, 'm42')} {normyData.data_stanu} {ui(lang, 'm43')}{' '}
        </div>
      </div>
      <div className="steel-panel p-4 rounded-sm bg-obsidian-850 border border-obsidian-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-steel-300 absolute left-3 top-3" />
          <input
            type="text"
            aria-label={copy.search} placeholder={copy.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="im-field w-full bg-obsidian-950 border border-steel-700 rounded-sm pl-9 pr-4 py-2 text-xs text-white placeholder-steel-300 focus:outline-none focus:border-tactical-ice"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto text-xs">
          <span className="text-steel-300">{ui(lang, 'm45')} </span>
          <select
            aria-label={copy.status} value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="im-field bg-obsidian-950 border border-steel-700 text-steel-100 rounded-sm px-3 py-1.5 focus:outline-none focus:border-tactical-ice text-xs"
          >
            <option value="all">{copy.all}</option><option value="verified">{copy.verified}</option><option value="pending">{copy.pending}</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.nav.norms}>{(['all','laws','constitution','courts','international'] as const).map(key => <button className={`action ${category === key ? 'border-justice-gold text-justice-gold' : ''}`} aria-pressed={category === key} key={key} onClick={() => setCategory(key)}>{copy[key]}</button>)}</div>
      <p role="status" className="text-sm text-steel-300" data-testid="norm-results">{copy.found}: {filteredNorms.length}</p>
      <div className="space-y-4">
        {[0,1,2,3,4].map(rank=>({rank,norms:filteredNorms.filter(n=>normHierarchy(n)===rank)})).filter(group=>group.norms.length>0).map(group=><AnimatedDetails open className="surface" key={group.rank} data-hierarchy={group.rank}><summary className="font-serif text-lg text-steel-100">{group.rank+1}. {product[lang][`hierarchy${group.rank}` as 'hierarchy0']} ({group.norms.length})</summary><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {group.norms.map((norm, index) => {
          const isVerified = norm.status_zvirky === 'zvireno';
          const isRecommended =
            norm.status_zvirky === 'zvireno-rekomendatsiinyi';
          const usedInScenarios = usageMap[norm.id] || [];

          return (
            <React.Fragment key={norm.id}>
              {(index === 0 || group.norms[index - 1].akt !== norm.akt) && (
                <h2 className="col-span-full font-serif text-xl font-bold mt-4">
                  {norm.akt}
                </h2>
              )}
              <div
                key={norm.id}
                data-testid="norm-card" data-norm-id={norm.id}
                onClick={() => setActiveNorm(norm)}
                className="steel-panel p-5 rounded-sm bg-obsidian-850 border border-obsidian-800 hover:border-tactical-ice/40 hover:bg-obsidian-850 transition-all cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 gap-2">
                    <span className="norm-code im-tag font-mono text-xs font-bold px-2 py-0.5 rounded-sm bg-obsidian-800 text-tactical-ice border border-tactical-ice">
                      {formatNormBadge(norm, lang)}
                    </span>
                    <span
                      className={`im-tag text-[11px] px-2 py-0.5 rounded-sm border flex items-center gap-1 font-medium ${
                        isVerified
                          ? 'bg-status-success/10 text-status-success border-status-success/30'
                          : isRecommended
                            ? 'bg-tactical-ice/10 text-tactical-ice border-tactical-ice/30'
                            : 'bg-status-warning/10 text-status-warning border-status-warning/30'
                      }`}
                    >
                      {isVerified ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {isVerified
                        ? ui(lang, 'm50')
                        : isRecommended
                          ? ui(lang, 'm51')
                          : ui(lang, 'm52')}
                    </span>
                  </div>

                  <h3 className="im-section-title font-bold text-sm text-white ">
                    {norm.akt}
                  </h3>

                  <p className="text-xs text-steel-300  leading-relaxed">
                    {norm.korotko}
                  </p>
                </div>

                <div className="pt-2 border-t border-obsidian-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-steel-300">
                  <span>{norm.redaktsiia}</span>
                  {usedInScenarios.length > 0 && (
                    <span className="flex items-center gap-1 text-status-success font-mono">
                      <Tag className="w-3 h-3" />
                      {usedInScenarios
                        .map((id) => caseLabel(id, lang))
                        .join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}</div></AnimatedDetails>)}
      </div>
      <NormDetailModal norm={activeNorm} onClose={() => setActiveNorm(null)} />
    </div>
  );
};
