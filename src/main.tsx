import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { Capacitor } from '@capacitor/core'
import { applyTheme } from './lib/store'

applyTheme()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// phones cache map tiles as files (lib/tilecache.ts); iOS cannot run service workers in the app
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
