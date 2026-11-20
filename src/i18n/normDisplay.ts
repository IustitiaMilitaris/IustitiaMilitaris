import type { Language } from './index';

export function formatNormDisplayId(id: string, lang: Language): string {
  const uk = lang === 'uk';
  const exact: Record<string, [string, string]> = {
    'KMU-1195':['ПКМУ № 1195','CMU Res. No. 1195'],
    'NAZK-MR2-8':['Мет. рек. НАЗК № 2','NACP Guid. No. 2'],
    'NAZK-R4-194':['Роз’ясн. НАЗК № 4','NACP Clarif. No. 4'],
    'OECD-0435':['ОЕСР/LEGAL/0435','OECD/LEGAL/0435'],
    'VS-9901-72-19':['ВП ВС','SC Grand Chamber'],
    'VS-335-10825-16':['ККС ВС','SC Criminal Court']
  };
  if (exact[id]) return exact[id][uk ? 0 : 1];
  const prefix = id.split('-')[0];
  const codes: Record<string, [string, string]> = { KONST:['Конституція','Constitution'], KZPP:['КЗпП','Labor Code'], KK:['ККУ','Criminal Code'], KUPAP:['КУпАП','Admin. Code'] };
  if (codes[prefix]) return codes[prefix][uk ? 0 : 1];
  const laws: Record<string,string> = { ZPK:'1700-VII', ZAD:'4742-IX', ZO:'2145-VIII', SVS:'548-XIV', DS:'889-VIII', EQUAL:'2866-IV', PROC:'922-VIII' };
  return laws[prefix] ? `${uk ? 'ЗУ №' : 'Law No.'} ${laws[prefix]}` : id;
}

export function formatNormChipPoint(norm: { id: string; punkt: string; typ?: string }, lang: Language): string {
  if (norm.typ === 'sudova-praktyka' || /^(VS|SUPREME)-/.test(norm.id)) {
    const number = norm.punkt.match(/\d+\/\d+\/\d+(?:-[\p{L}]+)?/u)?.[0];
    if (number) return `${lang === 'uk' ? '№' : 'No.'} ${number}`;
  }
  const short = norm.punkt.split(/\s+[—–]\s+|:/)[0].trim();
  return lang === 'en' ? short.replace(/^Article\b/i, 'Art.') : short;
}

export function formatNormBadge(norm: { id: string; punkt: string; typ?: string }, lang: Language): string {
  const point = formatNormChipPoint(norm, lang);
  return `${formatNormDisplayId(norm.id, lang)}${point ? ` · ${point}` : ''}`;
}
