import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { createBackup, parseBackup } from './persistence'
import type { Backup, SaveResult } from './persistence'
import type { AppData } from './model'

function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function BackupPanel({ data, unsaved, raw, blocked, onRestore, onReset }: {
  data: AppData | null
  unsaved: boolean
  raw: string | null
  blocked: boolean
  onRestore: (json: string) => SaveResult
  onReset: () => SaveResult
}) {
  const [pending, setPending] = useState<{ backup: Backup; json: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const preview = useRef<HTMLElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pending) preview.current?.focus()
  }, [pending])

  function exportData() {
    if (!data) return
    try {
      const backup = createBackup(data)
      downloadText(backup.filename, backup.json)
      setError('')
      setNotice('Backup download requested. Check your browser downloads.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The backup could not be exported.')
    }
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setPending(null)
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a backup smaller than 10 MB.')
      const json = await file.text()
      setPending({ backup: parseBackup(json), json })
    } catch (error) {
      setError(`${error instanceof Error ? error.message : 'The file could not be read.'} Current data is unchanged.`)
    } finally {
      input.value = ''
      setBusy(false)
    }
  }

  function confirmRestore() {
    if (!pending) return
    if (!window.confirm('Replace ALL current Calendar, Finance and Compass data with this backup? This also discards current session edits. Export your current data first. This cannot be undone.')) {
      setNotice('Restore cancelled. Current data is unchanged.')
      return
    }
    const result = onRestore(pending.json)
    if (!result.ok) { setError(result.message); return }
    setPending(null)
    setError('')
    setNotice('Backup restored and saved in this browser.')
  }

  function reset() {
    if (!window.confirm('Start fresh and replace the unreadable browser data with starter suggestions? Download the unreadable data first. This permanently replaces it and cannot be undone.')) return
    const result = onReset()
    if (!result.ok) { setError(result.message); return }
    setPending(null)
    setError('')
    setNotice('A fresh workspace was saved in this browser.')
  }

  function exportRaw() {
    if (raw === null) return
    try {
      downloadText(`lifeos-unreadable-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`, raw, 'text/plain')
      setError('')
      setNotice('Unreadable data download requested. Keep this file; it is not a validated backup.')
    } catch {
      setError('The unreadable data could not be downloaded. Existing browser data is unchanged.')
    }
  }

  return (
    <details className="backup-panel" open={blocked}>
      <summary>Backup &amp; recovery</summary>
      <div className="backup-actions">
        {data && <button type="button" className="secondary" onClick={exportData}><Download size={18} aria-hidden="true" /> {unsaved ? 'Export current session' : 'Export JSON'}</button>}
        {raw !== null && <button type="button" className="secondary" onClick={exportRaw}><Download size={18} aria-hidden="true" /> Download unreadable data</button>}
      </div>
      {unsaved && <p className="backup-warning">Export includes submitted edits held only in this session. They have not been saved in this browser.</p>}
      <div className="event-field backup-file">
        <label htmlFor="backup-file"><Upload size={16} aria-hidden="true" /> Choose JSON backup</label>
        <input ref={fileInput} id="backup-file" type="file" accept=".json,application/json" disabled={busy} onChange={readFile} />
      </div>
      <p className="compass-context">Restore replaces all data, not a merge. Export first. Unsubmitted form drafts are not included in exports.</p>
      {busy && <p role="status">Reading backup...</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {notice && <p className="backup-notice" role="status">{notice}</p>}
      {pending && (
        <section ref={preview} tabIndex={-1} className="backup-preview" aria-labelledby="backup-preview-title">
          <h2 id="backup-preview-title">Incoming backup</h2>
          <p>Schema version {pending.backup.schemaVersion}. Exported {new Date(pending.backup.exportedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })} (London).</p>
          <p className="backup-direction">{pending.backup.data.northStar.statement}</p>
          <dl className="backup-counts">
            <div><dt>Calendar events</dt><dd>{pending.backup.data.calendarEvents.length}</dd></div>
            <div><dt>Budget months</dt><dd>{pending.backup.data.budgets.length}</dd></div>
            <div><dt>Budget categories</dt><dd>{pending.backup.data.financeCategories.length}</dd></div>
            <div><dt>Expenses</dt><dd>{pending.backup.data.expenses.length}</dd></div>
            <div><dt>Compass items</dt><dd>{pending.backup.data.compassItems.length}</dd></div>
            <div><dt>Life areas</dt><dd>{pending.backup.data.lifeAreas.length}</dd></div>
            <div><dt>Time logs</dt><dd>{pending.backup.data.timeLogs.length}</dd></div>
          </dl>
          <p>North star and weekly settings are included. Replacing will remove current data, including anything absent from this backup.</p>
          <div className="event-actions">
            <button type="button" className="primary" onClick={confirmRestore}>Replace current data</button>
            <button type="button" className="secondary" onClick={() => { setPending(null); setError(''); setNotice('Import cancelled. Current data is unchanged.'); fileInput.current?.focus() }}>Cancel import</button>
          </div>
        </section>
      )}
      {blocked && raw !== null && <button type="button" className="secondary reset-workspace" onClick={reset}>Start fresh</button>}
    </details>
  )
}