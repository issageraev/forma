import { dkey } from './dates'
import type { DayStatus, Workout } from './types'

export const AUTO_FINISH_MS = 60 * 60 * 1000

export const doneSetsCount = (w: Workout) => w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)
export const totalSetsCount = (w: Workout) => w.exercises.reduce((a, e) => a + e.sets.length, 0)
export const tonnage = (w: Workout) =>
  w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).reduce((b, s) => b + (s.w ?? 0) * (s.r ?? 0), 0), 0)
export const isExerciseDone = (e: Workout['exercises'][number]) => e.sets.length > 0 && e.sets.every(s => s.done)

export function dayStatus(w: Workout | undefined, today = dkey()): DayStatus | 'empty' {
  if (!w) return 'empty'
  if (w.status === 'planned' && w.date < today) return 'missed'
  return w.status
}

export const STATUS_LABEL: Record<DayStatus | 'empty', string> = {
  planned: 'Запланирована',
  active: 'Идёт',
  done: 'Завершена',
  missed: 'Пропущена',
  empty: 'Свободно',
}

/**
 * Жизненный цикл: тренировка без новых подходов дольше часа завершается сама.
 * Время окончания — момент последнего подхода, чтобы длительность была честной.
 * Если не было ни одного подхода — тренировка возвращается в план.
 */
export function autoFinishPatch(w: Workout, now = Date.now()): Partial<Workout> | null {
  if (w.status !== 'active') return null
  const last = w.lastActivityAt ?? w.startedAt ?? now
  if (now - last < AUTO_FINISH_MS) return null
  if (doneSetsCount(w) === 0) return { status: 'planned', startedAt: undefined, lastActivityAt: undefined }
  return { status: 'done', finishedAt: last, autoFinished: true }
}

/** Убирает пустые невыполненные подходы и упражнения без подходов при завершении */
export function pruneOnFinish(w: Workout): Workout['exercises'] {
  return w.exercises
    .map(e => ({ ...e, sets: e.sets.filter(s => s.done || s.w != null || s.r != null) }))
    .filter(e => e.sets.length > 0)
}
