export function normHierarchy(norm: {id:string;typ:string}): number {
  if (/^(KONST|CONST)-/.test(norm.id)) return 0;
  if (/^(KZPP|KKU?|KUPAP)-/.test(norm.id) || norm.typ==='kodeks') return 1;
  if (norm.typ==='zakon') return 2;
  if (norm.typ==='sudova-praktyka') return 3;
  return 4;
}
