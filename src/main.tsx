import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadData, saveData } from './persistence'
import type { SaveResult } from './persistence'

const initialLoad = loadData()
let initialSaveResult: SaveResult | null = null
if (initialLoad.status === 'ready') {
  initialSaveResult = initialLoad.saved ? { ok: true } : saveData(initialLoad.data)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialLoad={initialLoad} initialSaveResult={initialSaveResult} />
  </StrictMode>,
)
