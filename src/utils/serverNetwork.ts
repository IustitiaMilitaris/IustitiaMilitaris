export type ServerNetwork = { preferredOrigin: string; lanIps: string[]; lanUrls: string[] };
export function privateIpv4(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const n = host.split('.').map(Number);
  return n.every(v => v <= 255) && (n[0] === 10 || n[0] === 192 && n[1] === 168 || n[0] === 172 && n[1] >= 16 && n[1] <= 31);
}
export function networkRedirect(current: string, info: ServerNetwork): string | null {
  try {
    const from = new URL(current), to = new URL(info.preferredOrigin);
    if (!privateIpv4(from.hostname) || info.lanIps.includes(from.hostname) || !privateIpv4(to.hostname) || !info.lanIps.includes(to.hostname) || to.protocol !== 'http:' || from.port !== to.port || to.username || to.password || to.pathname !== '/' || to.search || to.hash) return null;
    return to.origin + from.pathname + from.search + from.hash;
  } catch { return null; }
}
