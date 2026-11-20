import { formatNormChipPoint, formatNormBadge, formatNormDisplayId } from '../i18n/normDisplay';
import { AnimatedOverlay } from './Collapsible';
import { safeExternalUrl } from '../utils/security';
import { localizeNorm } from '../i18n/content';
import { useLanguage } from '../i18n/ui';
import { ui } from '../i18n/ui';
import React, { useRef } from 'react';
import { X, BookOpen, ExternalLink, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { NormEntry } from '../types';

interface NormDetailModalProps {
  norm: NormEntry | null;
  yakZastosovuietsia?: string;
  onClose: () => void;
}

export const NormDetailModal: React.FC<NormDetailModalProps> = ({ norm: originalNorm, yakZastosovuietsia, onClose }) => {
  const lang = useLanguage();
  const previous = useRef(originalNorm);
  if (originalNorm) previous.current = originalNorm;
  const cached = originalNorm || previous.current;
  const norm = cached ? localizeNorm(cached, lang) : null;
  if (!norm) return null;

  const isVerified = norm.status_zvirky === 'zvireno';
  const isRecommended = norm.status_zvirky === 'zvireno-rekomendatsiinyi';

  return (
    <AnimatedOverlay onClose={onClose} isOpen={!!originalNorm} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-label={ui(lang, 'closeDialog')}
        className="steel-panel animate-fadeIn relative w-full max-w-2xl bg-obsidian-850 border border-steel-700 rounded-sm shadow-2xl p-6 sm:p-7 text-steel-100 max-h-[85dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-steel-700">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-sm bg-tactical-ice/20 text-tactical-ice border border-tactical-ice/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="norm-code im-tag font-mono text-xs font-bold px-2 py-0.5 rounded-sm bg-obsidian-800 text-tactical-ice border border-tactical-ice">
                  {formatNormBadge(norm, lang)}
                </span>
                {norm.punkt !== formatNormChipPoint(norm, lang) && <span className="text-xs text-steel-300">{norm.punkt}</span>}
              </div>
              <h2 className="im-title font-serif text-base sm:text-lg font-bold text-white mt-1 break-words">
                {norm.akt}
              </h2>
            </div>
          </div>
          <button
            aria-label={ui(lang, 'closeDialog')}
            onClick={onClose}
            className="whitespace-nowrap im-secondary p-1 rounded-sm text-steel-300 hover:text-white hover:bg-obsidian-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <div className={`px-2.5 py-1 rounded-sm border flex items-center gap-1.5 font-medium ${
            isVerified
              ? 'bg-status-success/10 border-status-success/30 text-status-success'
              : isRecommended
              ? 'bg-tactical-ice/10 border-tactical-ice/30 text-tactical-ice'
              : 'bg-status-warning/10 border-status-warning/30 text-status-warning'
          }`}>
            {isVerified || isRecommended ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>
              {isVerified ? ui(lang, 'm34') : isRecommended ? ui(lang, 'm35') : ui(lang, 'm36')}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-sm bg-obsidian-800 border border-steel-700 text-steel-300">
            <strong>{ui(lang, 'm37')}{' '}</strong> {norm.redaktsiia}
          </div>
        </div>
        {yakZastosovuietsia && (
          <div className="mt-4 p-3.5 rounded-sm bg-status-success/10 border border-status-success/25">
            <div className="text-xs font-bold text-status-success uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5" />
              {ui(lang, 'm38')}{' '}</div>
            <p className="text-sm text-steel-100 leading-relaxed">
              {yakZastosovuietsia}
            </p>
          </div>
        )}
        <div className="mt-4">
          <div className="text-xs font-bold text-steel-300 uppercase tracking-wider mb-1">
            {ui(lang, 'm39')}{' '}</div>
          <p className="text-sm text-steel-300 leading-relaxed">
            {norm.korotko}
          </p>
        </div>
        {norm.tsytaty && norm.tsytaty.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-bold text-status-warning uppercase tracking-wider">
              {ui(lang, 'm40')}{' '}</div>
            {norm.tsytaty.map((q, idx) => (
              <blockquote
                key={idx}
                className="p-3 rounded-sm bg-obsidian-950 border-l-4 border-status-warning text-xs sm:text-sm text-status-warning/90 italic"
              >
                «{q}»
              </blockquote>
            ))}
          </div>
        )}
        <div className="norm-modal-footer mt-6 pt-4 border-t border-steel-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 flex-1 text-xs text-steel-400 text-left break-words">
            {ui(lang, 'm41')}{' '}{norm.dzherelo_zvirky} ({norm.data_zvirky})
          </div>
          {safeExternalUrl(norm.posylannia) && (
            <a
              href={safeExternalUrl(norm.posylannia)}
              target="_blank"
              rel="noopener noreferrer"
              className="norm-external-link whitespace-nowrap im-secondary inline-flex items-center justify-center gap-2 shrink-0 w-fit max-w-full px-3.5 py-2 rounded-sm bg-obsidian-800 hover:bg-steel-700 text-tactical-ice border border-tactical-ice transition-colors font-medium"
            >
              <span>{new URL(safeExternalUrl(norm.posylannia)!).hostname.replace(/^www\./, '')}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          )}
        </div>
      </div>
    </AnimatedOverlay>
  );
};
