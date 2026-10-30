import { useEffect, useRef, useState } from 'react'
import type { AppData, CalendarEvent, CompassData, FinanceData } from './model'
import { createInitialData } from './model'
import BackupPanel from './BackupPanel'
import Calendar from './Calendar'
import Compass from './Compass'
import Finance from './Finance'
import { restoreBackup, saveData } from './persistence'
import type { LoadResult, SaveResult } from './persistence'

const pages = ['Calendar', 'Finance', 'Compass'] as const

function App({ initialLoad, initialSaveResult }: { initialLoad: LoadResult; initialSaveResult: SaveResult | null }) {
  const [page, setPage] = useState<(typeof pages)[number]>(() => pages.find((name) => window.location.hash === `#${name.toLowerCase()}`) ?? 'Calendar')
  const [loaded, setLoaded] = useState(initialLoad)
  const [data, setData] = useState<AppData | null>(() => loaded.status === 'ready' ? loaded.data : null)
  const [saveResult, setSaveResult] = useState<SaveResult | null>(initialSaveResult)
  const [revision, setRevision] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [page, revision])

  useEffect(() => {
    if (!saveResult || saveResult.ok) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saveResult])

  function applyRestored(next: AppData) {
    setData(next)
    setLoaded({ status: 'ready', data: next, saved: true })
    setSaveResult({ ok: true })
    setRevision((value) => value + 1)
  }

  function restore(json: string): SaveResult {
    const result = restoreBackup(json)
    if (!result.ok) return result
    applyRestored(result.data)
    return { ok: true }
  }

  function startFresh(): SaveResult {
    const next = createInitialData()
    const result = saveData(next)
    if (!result.ok) return { ok: false, message: 'A fresh workspace could not be saved. Existing browser data is unchanged.' }
    applyRestored(next)
    return { ok: true }
  }

  function saveCalendarEvents(events: CalendarEvent[]) {
    if (!data) return
    const next = { ...data, calendarEvents: events }
    setData(next)
    setSaveResult(saveData(next))
  }

  function saveCompass(compass: CompassData) {
    if (!data) return
    const next = { ...data, northStar: compass.northStar, lifeAreas: compass.lifeAreas, weeklySettings: compass.weeklySettings, compassItems: compass.compassItems, timeLogs: compass.timeLogs }
    setData(next)
    setSaveResult(saveData(next))
  }

  function saveFinance(finance: FinanceData) {
    if (!data) return
    const next = { ...data, financeCategories: finance.financeCategories, budgets: finance.budgets, expenses: finance.expenses }
    setData(next)
    setSaveResult(saveData(next))
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar">
        <div className="brand">Life OS</div>
        <p className="sidebar-caption">Room for a whole life.</p>
        <nav aria-label="Main navigation">
          {pages.map((name) => (
            <button
              key={name}
              type="button"
              aria-current={page === name ? 'page' : undefined}
              onClick={() => { setPage(name); window.history.replaceState(null, '', `#${name.toLowerCase()}`) }}
            >
              {name}
            </button>
          ))}
        </nav>
        <p className="privacy-note">
          Data stays in this browser. No automatic sync across devices.
        </p>
      </aside>
      <main id="main" tabIndex={-1}>
        <header className="page-header">
          <div>
            <p className="eyebrow">Personal workspace</p>
            <h1 ref={heading} tabIndex={-1}>{page}</h1>
          </div>
          <span className="stage-label">{page === 'Calendar' ? 'Manual planning' : page === 'Finance' ? 'Monthly budget' : 'Direction & time'}</span>
        </header>
        <section className="storage-banner" aria-label="Browser storage">
          <p>Saved only in this browser. No automatic device sync. Keep a JSON backup and use one tab at a time.</p>
          {data && <>
            <div className={saveResult && !saveResult.ok ? 'storage-error' : 'storage-status'} role={saveResult && !saveResult.ok ? 'alert' : 'status'}>
              {saveResult === null ? 'Save status unavailable.' : saveResult.ok ? 'Saved in this browser.' : saveResult.message}
            </div>
            {saveResult && !saveResult.ok && <button type="button" className="secondary" onClick={() => setSaveResult(saveData(data))}>Retry saving</button>}
          </>}
          <BackupPanel data={data} unsaved={saveResult?.ok === false} raw={loaded.status === 'blocked' ? loaded.raw : null} blocked={loaded.status === 'blocked'} onRestore={restore} onReset={startFresh} />
        </section>
        <div key={revision} className="workspace-content">
        {loaded.status === 'blocked' ? (
          <section className="storage-error" role="alert">
            <h2>Saved data could not be opened</h2>
            <p>{loaded.message}</p>
            <button type="button" className="secondary" onClick={() => window.location.reload()}>Reload and try again</button>
          </section>
        ) : data && page === 'Calendar' ? (
          <Calendar events={data.calendarEvents} lifeAreas={data.lifeAreas} onChange={saveCalendarEvents} />
        ) : data && page === 'Finance' ? (
          <Finance data={{ financeCategories: data.financeCategories, budgets: data.budgets, expenses: data.expenses }} onChange={saveFinance} />
        ) : data && page === 'Compass' ? (
          <Compass data={{ northStar: data.northStar, lifeAreas: data.lifeAreas, weeklySettings: data.weeklySettings, compassItems: data.compassItems, timeLogs: data.timeLogs }} calendarEvents={data.calendarEvents} onChange={saveCompass} />
        ) : (
          <section className="empty-state" aria-labelledby="section-title">
            <h2 id="section-title">{page} is not built yet</h2>
          </section>
        )}
        </div>
      </main>
    </div>
  )
}

export default App
