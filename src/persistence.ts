import { isDate, sumSafe } from './domain'
import { createInitialData } from './model'
import type { AppData } from './model'

export const STORAGE_KEY = 'lifeos:v1'
export type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>
export type LoadResult =
  | { status: 'ready'; data: AppData; saved: boolean }
  | { status: 'blocked'; message: string; raw: string | null }
export type SaveResult = { ok: true } | { ok: false; message: string }
export interface Backup {
  schemaVersion: 1
  exportedAt: string
  data: AppData
}
export type RestoreResult = { ok: true; data: AppData } | { ok: false; message: string }

function requireValid(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function record(value: unknown): Record<string, unknown> {
  requireValid(typeof value === 'object' && value !== null && !Array.isArray(value), 'Expected a data object.')
  return value as Record<string, unknown>
}

function text(value: unknown, blank = false): string {
  requireValid(typeof value === 'string', 'Expected text.')
  requireValid((blank || value.trim().length > 0) && value.length <= 10000, 'Text must be non-empty and at most 10,000 characters.')
  return value
}

function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  requireValid(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, 'Invalid numeric amount.')
  return value
}

function nullableMinutes(value: unknown): void {
  if (value !== null) integer(value, 0, 10080)
}

function choice(value: unknown, allowed: readonly string[]): void {
  requireValid(typeof value === 'string' && allowed.includes(value), 'Invalid item type or status.')
}

function rows(value: unknown, key = 'id'): Record<string, unknown>[] {
  requireValid(Array.isArray(value), 'Expected a list.')
  const result = value.map(record)
  const keys = result.map((row) => text(row[key]))
  requireValid(keys.every((id) => !['__proto__', 'constructor', 'prototype'].includes(id)), 'Reserved record identifier.')
  requireValid(new Set(keys).size === keys.length, 'Duplicate record identifiers.')
  return result
}

function reference(value: unknown, ids: Set<string>): void {
  requireValid(ids.has(text(value)), 'A record refers to a missing life area or category.')
}

function namedRows(value: unknown): Set<string> {
  const items = rows(value)
  const names = items.map((item) => text(item.name).trim().toLocaleLowerCase('en-GB'))
  requireValid(new Set(names).size === names.length, 'Duplicate area or category names.')
  return new Set(items.map((item) => text(item.id)))
}

export function validateData(value: unknown): asserts value is AppData {
  const data = record(value)
  requireValid(data.schemaVersion === 1, 'Unsupported data version. This app supports version 1.')
  const northStar = record(data.northStar)
  text(northStar.statement)
  text(northStar.why)
  const areas = namedRows(data.lifeAreas)
  const categories = namedRows(data.financeCategories)
  const settings = record(data.weeklySettings)
  reference(settings.makerAreaId, areas)
  nullableMinutes(settings.availableMinutes)
  nullableMinutes(settings.makerTargetMinutes)

  for (const event of rows(data.calendarEvents)) {
    text(event.title)
    requireValid(isDate(event.date), 'Invalid event date.')
    requireValid(typeof event.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(event.startTime), 'Invalid event time.')
    integer(event.durationMinutes, 1, 1440)
    reference(event.lifeAreaId, areas)
    text(event.notes, true)
  }

  for (const budget of rows(data.budgets, 'month')) {
    requireValid(typeof budget.month === 'string' && isDate(`${budget.month}-01`), 'Invalid budget month.')
    if (budget.incomePennies !== null) integer(budget.incomePennies)
    const allocations = record(budget.allocations)
    for (const [categoryId, amount] of Object.entries(allocations)) {
      reference(categoryId, categories)
      integer(amount)
    }
    sumSafe(Object.values(allocations).map((amount) => integer(amount)))
  }

  const expenses = rows(data.expenses)
  for (const expense of expenses) {
    integer(expense.amountPennies, 1)
    requireValid(isDate(expense.date), 'Invalid expense date.')
    reference(expense.categoryId, categories)
    text(expense.description)
  }
  sumSafe(expenses.map((expense) => integer(expense.amountPennies)))

  for (const item of rows(data.compassItems)) {
    text(item.title)
    choice(item.type, ['task', 'goal', 'commitment', 'dream'])
    choice(item.status, ['active', 'later', 'done'])
    choice(item.planningRole, ['outcome', 'activity'])
    reference(item.lifeAreaId, areas)
    requireValid(item.dueDate === null || isDate(item.dueDate), 'Invalid due date.')
    nullableMinutes(item.weeklyMinutes)
    requireValid(item.planningRole !== 'outcome' || item.weeklyMinutes === null, 'Outcomes cannot have a separate weekly time estimate.')
    text(item.notes, true)
    requireValid(typeof item.suggested === 'boolean', 'Invalid suggestion flag.')
  }

  for (const log of rows(data.timeLogs)) {
    requireValid(isDate(log.date), 'Invalid time-log date.')
    reference(log.lifeAreaId, areas)
    integer(log.durationMinutes, 1, 1440)
  }
  sumSafe((data.timeLogs as AppData['timeLogs']).map((log) => log.durationMinutes))
  sumSafe((data.compassItems as AppData['compassItems']).map((item) => item.weeklyMinutes ?? 0))
}

export function loadData(storage?: StorageAdapter): LoadResult {
  let raw: string | null
  try {
    raw = (storage ?? window.localStorage).getItem(STORAGE_KEY)
  } catch {
    return { status: 'blocked', raw: null, message: 'Browser storage is unavailable. Check your browser privacy settings, then reload or restore a backup. No data has been changed.' }
  }
  if (raw === null) return { status: 'ready', data: createInitialData(), saved: false }
  try {
    const data: unknown = JSON.parse(raw)
    validateData(data)
    return { status: 'ready', data, saved: true }
  } catch (error) {
    const detail = error instanceof SyntaxError ? 'Stored JSON is not readable.' : error instanceof Error ? error.message : 'Invalid saved data.'
    return { status: 'blocked', raw, message: `${detail} Existing browser data has been left untouched. Download the unreadable data before restoring a valid backup or explicitly starting fresh.` }
  }
}

export function saveData(data: AppData, storage?: StorageAdapter): SaveResult {
  try {
    validateData(data)
    const target = storage ?? window.localStorage
    target.setItem(STORAGE_KEY, JSON.stringify(data))
    return { ok: true }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Browser storage is unavailable.'
    return { ok: false, message: `Not saved: ${detail} Your latest changes are only in memory. Keep this page open, export current session data, or retry saving.` }
  }
}

export function createBackup(data: AppData, now = new Date()) {
  validateData(data)
  const exportedAt = now.toISOString()
  const backup: Backup = { schemaVersion: 1, exportedAt, data }
  return {
    filename: `lifeos-v1-${exportedAt.replace(/[:.]/g, '-')}.json`,
    json: JSON.stringify(backup, null, 2),
  }
}

export function parseBackup(json: string): Backup {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('This file is not readable JSON. Choose a Life OS JSON backup.')
  }
  const backup = record(value)
  requireValid(backup.schemaVersion === 1, 'Unsupported backup version. This app supports version 1.')
  requireValid(typeof backup.exportedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(backup.exportedAt)
    && Number.isFinite(Date.parse(backup.exportedAt)) && new Date(backup.exportedAt).toISOString() === backup.exportedAt, 'Invalid backup export date.')
  validateData(backup.data)
  return { schemaVersion: 1, exportedAt: backup.exportedAt as string, data: backup.data }
}

export function restoreBackup(json: string, storage?: StorageAdapter): RestoreResult {
  let backup: Backup
  try {
    backup = parseBackup(json)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Invalid backup.' }
  }
  const result = saveData(backup.data, storage)
  return result.ok ? { ok: true, data: backup.data }
    : { ok: false, message: 'Restore could not be saved. Existing browser and session data are unchanged. Check available browser storage and try again.' }
}