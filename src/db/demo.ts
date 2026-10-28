import { db } from './db'
import { newSet, uid } from './repo'
import { addDays, dkey, startOfWeek } from '../domain/dates'
import type { BodyEntry, Workout } from '../domain/types'

/** Демо-данные за 6 недель, чтобы посмотреть приложение «в работе». Стираются в настройках. */
export async function loadDemo() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const mon = startOfWeek(today)
  const plan = [
    { dow: 0, title: 'Грудь / Трицепс', ex: [['bench-press', 80, 2.5, 8], ['incline-db-press', 28, 1, 10], ['dips', 10, 2.5, 10], ['skull-crusher', 30, 1.25, 12]] },
    { dow: 1, title: 'Спина / Бицепс', ex: [['deadlift', 130, 5, 5], ['pull-ups', 5, 2.5, 8], ['barbell-row', 65, 2.5, 10], ['barbell-curl', 32.5, 1.25, 10]] },
    { dow: 3, title: 'Ноги', ex: [['squat', 105, 5, 6], ['leg-press', 180, 10, 12], ['rdl', 85, 2.5, 10]] },
    { dow: 4, title: 'Плечи', ex: [['ohp', 47.5, 2.5, 8], ['lateral-raise', 10, 1, 15], ['upright-row', 32.5, 1.25, 12]] },
  ] as const
  const workouts: Workout[] = []
  const body: BodyEntry[] = []
  for (let wk = 5; wk >= 0; wk--) {
    const i = 5 - wk
    const step = i === 3 ? i - 1 : i
    const bw = +(84.2 - i * 0.36).toFixed(1)
    body.push({ date: dkey(addDays(mon, -wk * 7)), kg: bw })
    for (const p of plan) {
      const day = addDays(mon, -wk * 7 + p.dow)
      const date = dkey(day)
      if (day >= today) continue
      const missed = wk === 1 && p.dow === 4
      const start = new Date(day); start.setHours(19, 5)
      const t0 = start.getTime()
      workouts.push({
        id: uid(), date, title: p.title, status: missed ? 'planned' : 'done', time: '19:00', bodyWeight: missed ? null : bw,
        startedAt: missed ? undefined : t0, finishedAt: missed ? undefined : t0 + (62 + p.dow * 4) * 60000,
        exercises: missed ? [] : p.ex.map(([exerciseId, base, inc, reps]) => ({
          id: uid(), exerciseId,
          sets: Array.from({ length: 4 }, (_, s) => ({ ...newSet(+(base + inc * step).toFixed(2), s === 3 ? reps - 2 : reps), done: true, doneAt: t0 + s * 180000 })),
        })),
        createdAt: t0, updatedAt: t0,
      })
    }
  }
  const program = { 1: 'Грудь / Трицепс', 2: 'Спина / Бицепс', 4: 'Ноги', 5: 'Плечи' }
  await db.transaction('rw', [db.workouts, db.body, db.settings], async () => {
    await db.workouts.bulkPut(workouts)
    await db.body.bulkPut(body)
    await db.settings.bulkPut([
      { key: 'program', value: program },
      { key: 'height', value: 182 },
      { key: 'demo', value: true },
    ])
  })
}
