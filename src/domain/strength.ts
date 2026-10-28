import type { Exercise, SetEntry, Workout } from './types'

/** Расчётный максимум (1ПМ) по формуле Эпли. Подходы больше 12 повторов не оцениваем — формула там врёт. */
export function e1rm(weight: number, reps: number): number | null {
  if (!(weight > 0) || !(reps >= 1) || reps > 12) return null
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

/** Нагрузка подхода с учётом вида упражнения (для упражнений со своим весом — вес тела + отягощение) */
export function loadOf(set: SetEntry, kind: Exercise['kind'], bodyWeight?: number | null) {
  if (kind === 'bodyweight') return bodyWeight ? bodyWeight + (set.w ?? 0) : null
  return set.w ?? null
}

/** Рабочие подходы: выполненные и не разминочные (≥ 60% от самого тяжёлого подхода в этот день) */
export function workingSets(sets: SetEntry[], kind: Exercise['kind'], bodyWeight?: number | null) {
  const done = sets.filter(s => s.done && (s.r ?? 0) > 0)
  const max = Math.max(0, ...done.map(s => loadOf(s, kind, bodyWeight) ?? 0))
  return done.filter(s => (loadOf(s, kind, bodyWeight) ?? 0) >= max * 0.6)
}

/** Лучший 1ПМ упражнения за одну тренировку */
export function sessionE1rm(sets: SetEntry[], kind: Exercise['kind'], bodyWeight?: number | null): number | null {
  if (kind === 'time') return null
  let best: number | null = null
  for (const s of workingSets(sets, kind, bodyWeight)) {
    const load = loadOf(s, kind, bodyWeight)
    const v = load != null && s.r != null ? e1rm(load, s.r) : null
    if (v != null && (best == null || v > best)) best = v
  }
  return best
}

export interface StrengthPoint { date: string; e1rm: number; topWeight: number; topReps: number }

/** История силы по упражнению: одна точка на завершённую тренировку */
export function strengthSeries(workouts: Workout[], exercise: Exercise, resolve: (id: string) => string = id => id): StrengthPoint[] {
  const points: StrengthPoint[] = []
  const sorted = [...workouts].filter(w => w.status === 'done').sort((a, b) => (a.date < b.date ? -1 : 1))
  for (const w of sorted) {
    const sets = w.exercises.filter(e => resolve(e.exerciseId) === exercise.id).flatMap(e => e.sets)
    const v = sessionE1rm(sets, exercise.kind, w.bodyWeight)
    if (v == null) continue
    const top = workingSets(sets, exercise.kind, w.bodyWeight).reduce((a, s) => ((s.w ?? 0) > (a.w ?? 0) ? s : a), sets[0])
    points.push({ date: w.date, e1rm: v, topWeight: top?.w ?? 0, topReps: top?.r ?? 0 })
  }
  return points
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Текущий уровень — медиана последних трёх тренировок, чтобы один плохой день не ронял график */
export function currentLevel(series: StrengthPoint[], upTo?: string): number | null {
  const list = upTo ? series.filter(p => p.date <= upTo) : series
  if (!list.length) return null
  return median(list.slice(-3).map(p => p.e1rm))
}

/** Изменение уровня в процентах относительно уровня на дату `since` */
export function changePct(series: StrengthPoint[], since: string): number | null {
  const now = currentLevel(series)
  const before = currentLevel(series, since)
  if (now == null || before == null || before === 0) return null
  if (!series.some(p => p.date > since)) return 0
  return ((now - before) / before) * 100
}

/** Общий силовой индекс: средний % роста по основным упражнениям, у которых есть данные */
export function strengthIndex(changes: (number | null)[]): number | null {
  const xs = changes.filter((x): x is number => x != null)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}
