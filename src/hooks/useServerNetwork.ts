import { useEffect } from 'react';
import { networkRedirect, type ServerNetwork } from '../utils/serverNetwork';
export function useServerNetwork() {
  useEffect(() => {
    let stopped = false, probe: WebSocket | undefined, timeout: ReturnType<typeof setTimeout> | undefined;
    const update = (event: Event) => {
      const info = (event as CustomEvent<ServerNetwork>).detail;
      const target = networkRedirect(location.href, info);
      if (!target || probe) return;
      // Probe via WebSocket: CSP permits ws:, without widening HTTP connect-src.
      probe = new WebSocket(info.preferredOrigin.replace('http:', 'ws:') + '/ws?network-probe=1');
      timeout = setTimeout(() => { probe?.close(); probe = undefined; }, 3000);
      probe.onopen = () => { clearTimeout(timeout); probe?.close(); if (!stopped) location.replace(target); };
      probe.onerror = () => { clearTimeout(timeout); probe?.close(); probe = undefined; };
    };
    const refresh = () => { void fetch('/api/server-info').then(r => r.ok ? r.json() : null).then(info => { if (!stopped && info) window.dispatchEvent(new CustomEvent('server-network', { detail: info })); }).catch(() => {}); };
    window.addEventListener('server-network', update);
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { stopped = true; clearInterval(timer); clearTimeout(timeout); probe?.close(); window.removeEventListener('server-network', update); };
  }, []);
}
