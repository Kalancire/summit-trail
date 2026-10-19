import { useSyncExternalStore } from 'react'
const sub = (cb: () => void) => {
  addEventListener('online', cb); addEventListener('offline', cb)
  return () => { removeEventListener('online', cb); removeEventListener('offline', cb) }
}
export const useOnline = () => useSyncExternalStore(sub, () => navigator.onLine, () => true)
