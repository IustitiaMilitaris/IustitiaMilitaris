export type ProgressMode = 'none' | '10m' | '15m';
export function progressMode(value: unknown): ProgressMode { return value === '10m' || value === '15m' ? value : 'none'; }
export function progressKey(id: string, mode: ProgressMode) { return `${id}::${mode}`; }
