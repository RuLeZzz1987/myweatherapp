import { useEffect, useState } from 'react';

/**
 * Reactive `navigator.onLine`. The browser fires `online` / `offline` events
 * on `window`, which is the only signal we need — we don't try to ping the
 * worker because we surface offline state purely as an advisory banner.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    function onUp() {
      setOnline(true);
    }
    function onDown() {
      setOnline(false);
    }
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  return online;
}
