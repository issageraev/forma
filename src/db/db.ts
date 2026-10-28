import Dexie, { type Table } from 'dexie'
import type { BodyEntry, Exercise, WeekProgram, Workout } from '../domain/types'
import { CATALOG, DEFAULT_KEY_LIFTS } from '../domain/exercises'

export interface Settings {
  height: number | null
  program: WeekProgram
  keyLifts: string[]
  lastBackupAt: number | null
  demo: boolean
}

export const DEFAULT_SETTINGS: Settings = { height: null, program: {}, keyLifts: DEFAULT_KEY_LIFTS, lastBackupAt: null, demo: false }

interface SettingRow { key: keyof Settings; value: unknown }

class FormaDB extends Dexie {
  exercises!: Table<Exercise, string>
  workouts!: Table<Workout, string>
  body!: Table<BodyEntry, string>
  settings!: Table<SettingRow, string>

  constructor() {
    super('forma')
    // Каждое изменение схемы — новая версия с миграцией; старые данные Dexie переносит сам
    this.version(1).stores({
      exercises: 'id, category, archived',
      workouts: 'id, date, status',
      body: 'date',
      settings: 'key',
    })
    this.on('populate', tx => { tx.table('exercises').bulkAdd(CATALOG) })
  }
}

export const db = new FormaDB()

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map(r => [r.key, r.value])) } as Settings
}

export const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => db.settings.put({ key, value })

/** Просим браузер не вытеснять данные. На iOS приложение с экрана «Домой» и так защищено. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist?.()
    return (await navigator.storage?.persisted?.()) ?? false
  } catch {
    return false
  }
}
