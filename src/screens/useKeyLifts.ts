import { useMemo } from 'react'
import type { Exercise, Workout } from '../domain/types'
import { changePct, currentLevel, strengthIndex, strengthSeries } from '../domain/strength'

const SHORT: Record<string, string> = { 'bench-press': 'Жим лёжа', squat: 'Присед', deadlift: 'Становая', ohp: 'Жим стоя' }

/** Силовые показатели по основным упражнениям: текущий 1ПМ (медиана 3), изменение с даты `since`, история */
export function useKeyLifts(workouts: Workout[], exercises: Map<string, Exercise>, ids: string[], since: string) {
  return useMemo(() => {
    const rows = ids.map(id => exercises.get(id)).filter((e): e is Exercise => !!e && !e.archived).map(e => {
      const series = strengthSeries(workouts, e)
      return { id: e.id, name: e.name, short: SHORT[e.id] ?? e.name, series, level: currentLevel(series), change: changePct(series, since) }
    })
    return { rows, index: strengthIndex(rows.map(r => r.change)) }
  }, [workouts, exercises, ids, since])
}
