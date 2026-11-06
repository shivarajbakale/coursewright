/** Whether the device says it has a connection, as a hook that follows the 'online' and 'offline' events. */
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
