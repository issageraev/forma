import { db, setSetting } from './db'
import type { BodyEntry, Exercise, Workout } from '../domain/types'
import { dkey } from '../domain/dates'

const FORMAT = 'forma-backup'
const VERSION = 1

interface Backup {
  format: typeof FORMAT
  version: number
  exportedAt: string
  exercises: Exercise[]
  workouts: Workout[]
  body: BodyEntry[]
  settings: { key: string; value: unknown }[]
}

export async function buildBackup(): Promise<Backup> {
  const [exercises, workouts, body, settings] = await Promise.all([
    db.exercises.toArray(), db.workouts.toArray(), db.body.toArray(), db.settings.toArray(),
  ])
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), exercises, workouts, body, settings }
}

/**
 * Сохраняет копию через меню «Поделиться» (на iPhone → «Сохранить в Файлы» / iCloud Drive),
 * на компьютере — обычным скачиванием. Возвращает true, если копия действительно сохранена.
 */
export async function exportBackup(): Promise<boolean> {
  const data = await buildBackup()
  const name = `forma-${dkey()}.json`
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Копия «Формы»' })
    } else {
      const url = URL.createObjectURL(file)
      const a = Object.assign(document.createElement('a'), { href: url, download: name })
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return false
    throw e
  }
  await setSetting('lastBackupAt', Date.now())
  return true
}

export class BackupError extends Error {}

function validate(raw: unknown): Backup {
  const b = raw as Partial<Backup>
  if (!b || b.format !== FORMAT) throw new BackupError('Это не файл копии «Формы»')
  if ((b.version ?? 0) > VERSION) throw new BackupError('Копия сделана в более новой версии приложения — обновите приложение')
  if (!Array.isArray(b.workouts) || !Array.isArray(b.exercises)) throw new BackupError('Файл копии повреждён')
  for (const w of b.workouts) {
    if (typeof w.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(w.date) || !Array.isArray(w.exercises)) throw new BackupError('Файл копии повреждён')
  }
  return b as Backup
}

/** Полная замена данных из копии. Всё в одной транзакции: либо восстановится всё, либо ничего. */
export async function importBackup(file: File) {
  let parsed: unknown
  try { parsed = JSON.parse(await file.text()) } catch { throw new BackupError('Не удалось прочитать файл') }
  const b = validate(parsed)
  await db.transaction('rw', [db.exercises, db.workouts, db.body, db.settings], async () => {
    await Promise.all([db.exercises.clear(), db.workouts.clear(), db.body.clear(), db.settings.clear()])
    await db.exercises.bulkPut(b.exercises)
    await db.workouts.bulkPut(b.workouts)
    await db.body.bulkPut(b.body ?? [])
    await db.settings.bulkPut((b.settings ?? []) as never[])
  })
  return { workouts: b.workouts.length, exportedAt: b.exportedAt }
}
