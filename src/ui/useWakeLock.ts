import { useEffect } from 'react';

/** Keeps the screen on while the component is mounted (re-acquired when the tab comes back). */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const acquire = async () => {
      try {
        if (active && document.visibilityState === 'visible' && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
      } catch {
        /* not supported or denied (e.g. low battery) */
      }
    };
    const onVisible = () => void acquire();
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
}
