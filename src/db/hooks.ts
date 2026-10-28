import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, DEFAULT_SETTINGS, getSettings, type Settings } from './db'
import type { BodyEntry, Exercise, Workout } from '../domain/types'
import { dkey } from '../domain/dates'

const EMPTY: never[] = []

/** Все тренировки по дате. Даже за несколько лет это сотни записей — держим в памяти целиком. */
export function useWorkouts(): Workout[] | undefined {
  return useLiveQuery(() => db.workouts.orderBy('date').toArray(), [])
}

export function useExercises() {
  const list = useLiveQuery(() => db.exercises.toArray(), [], EMPTY as Exercise[])
  const byId = useMemo(() => new Map(list.map(e => [e.id, e])), [list])
  return { list, byId }
}

export function useSettings(): Settings {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS)
}

export function useBody(): BodyEntry[] {
  return useLiveQuery(() => db.body.orderBy('date').toArray(), [], EMPTY as BodyEntry[])
}

/** Индексы по тренировкам, которые нужны почти каждому экрану */
export function useWorkoutIndex(workouts: Workout[]) {
  return useMemo(() => {
    const today = dkey()
    const byDate = new Map<string, Workout>()
    for (const w of workouts) if (!byDate.has(w.date) || w.status !== 'planned') byDate.set(w.date, w)
    const active = workouts.find(w => w.status === 'active')
    const lastDone = [...workouts].reverse().find(w => w.status === 'done')
    const upcoming = workouts.find(w => w.status === 'planned' && w.date >= today)
    const titles = [...new Set([...workouts].reverse().map(w => w.title).filter(Boolean))]
    return { byDate, active, lastDone, upcoming, titles, today }
  }, [workouts])
}
