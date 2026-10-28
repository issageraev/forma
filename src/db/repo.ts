import { db, getSettings } from './db'
import type { Exercise, ExerciseKind, Category, SetEntry, Workout, WorkoutExercise } from '../domain/types'
import { CATALOG, findExact, normalize } from '../domain/exercises'
import { autoFinishPatch, pruneOnFinish } from '../domain/workout'
import { dkey } from '../domain/dates'

export const uid = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
export const newSet = (w: number | null = null, r: number | null = null): SetEntry => ({ id: uid(), w, r, done: false })

/** Атомарное изменение тренировки: читаем → меняем → пишем в одной транзакции */
export async function updateWorkout(id: string, fn: (w: Workout) => void) {
  await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(id)
    if (!w) return
    fn(w)
    w.updatedAt = Date.now()
    await db.workouts.put(w)
  })
}

const copyExercises = (src: WorkoutExercise[]): WorkoutExercise[] =>
  src.map(e => ({ id: uid(), exerciseId: e.exerciseId, sets: e.sets.filter(s => s.done || s.w != null).map(s => newSet(s.w, s.r)) }))

/** Последняя тренировка с таким же названием — шаблон упражнений */
export async function findTemplate(title: string, beforeDate: string) {
  const t = normalize(title)
  if (!t) return undefined
  const list = (await db.workouts.where('date').below(beforeDate).sortBy('date')).reverse()
  return list.find(w => normalize(w.title) === t && w.exercises.length > 0)
}

export async function createWorkout(date: string, title: string, opts: { templateId?: string; time?: string } = {}) {
  const tpl = opts.templateId ? await db.workouts.get(opts.templateId) : undefined
  const lastWeight = (await db.body.where('date').belowOrEqual(date).last())?.kg ?? null
  const now = Date.now()
  const w: Workout = {
    id: uid(), date, title: title.trim(), status: 'planned', time: opts.time, bodyWeight: lastWeight,
    exercises: tpl ? copyExercises(tpl.exercises) : [], createdAt: now, updatedAt: now,
  }
  await db.workouts.add(w)
  return w
}

export async function deleteWorkout(id: string) {
  await db.workouts.delete(id)
}

/** Восстановление после «Удалить» (отмена) */
export async function restoreWorkout(w: Workout) {
  await db.workouts.put(w)
}

/** Одна активная тренировка: перед стартом новой завершаем предыдущую */
export async function startWorkout(id: string) {
  const now = Date.now()
  await db.transaction('rw', db.workouts, async () => {
    const actives = await db.workouts.where('status').equals('active').toArray()
    for (const a of actives) if (a.id !== id) await finishInTx(a, now)
    const w = await db.workouts.get(id)
    if (!w || w.status !== 'planned') return
    w.status = 'active'
    w.startedAt = now
    w.lastActivityAt = now
    w.updatedAt = now
    await db.workouts.put(w)
  })
}

async function finishInTx(w: Workout, now: number) {
  w.exercises = pruneOnFinish(w)
  if (!w.exercises.some(e => e.sets.some(s => s.done))) {
    w.status = 'planned'
    w.startedAt = undefined
    w.lastActivityAt = undefined
  } else {
    w.status = 'done'
    w.finishedAt = w.lastActivityAt && w.date !== dkey() ? w.lastActivityAt : now
  }
  w.updatedAt = now
  await db.workouts.put(w)
}

export async function finishWorkout(id: string) {
  await db.transaction('rw', db.workouts, db.body, async () => {
    const w = await db.workouts.get(id)
    if (!w) return
    await finishInTx(w, Date.now())
    if (w.status === 'done' && w.bodyWeight) await db.body.put({ date: w.date, kg: w.bodyWeight })
  })
}

export async function reopenWorkout(id: string) {
  await updateWorkout(id, w => { w.status = 'active'; w.finishedAt = undefined; w.autoFinished = false; w.lastActivityAt = Date.now() })
}

/** Отметка подхода. Первый отмеченный подход сам запускает тренировку. */
export async function toggleSet(workoutId: string, weId: string, setId: string) {
  const now = Date.now()
  let needStart = false
  await updateWorkout(workoutId, w => {
    const s = w.exercises.find(e => e.id === weId)?.sets.find(x => x.id === setId)
    if (!s) return
    s.done = !s.done
    s.doneAt = s.done ? now : undefined
    if (s.done) w.lastActivityAt = now
    if (s.done && w.status === 'planned') needStart = true
  })
  if (needStart) await startWorkout(workoutId)
}

/** Проверка всех идущих тренировок на автозавершение (при запуске и раз в минуту) */
export async function autoFinishStale(now = Date.now()) {
  const actives = await db.workouts.where('status').equals('active').toArray()
  let finished = 0
  for (const w of actives) {
    const patch = autoFinishPatch(w, now)
    if (!patch) continue
    const next = { ...w, ...patch, updatedAt: now }
    if (next.status === 'done') next.exercises = pruneOnFinish(next)
    await db.workouts.put(next)
    if (next.status === 'done') {
      finished++
      if (next.bodyWeight) await db.body.put({ date: next.date, kg: next.bodyWeight })
    }
  }
  return finished
}

/** Добавить упражнение по имени: сначала ищем точное совпадение (с синонимами), дубль не создаём */
export async function ensureExercise(name: string, category: Category = 'Другое', kind: ExerciseKind = 'weight'): Promise<Exercise> {
  const all = await db.exercises.toArray()
  const exact = findExact(all, name)
  if (exact) return exact
  const e: Exercise = { id: 'c-' + uid(), name: name.trim().replace(/\s+/g, ' '), aliases: [], category, kind, custom: true }
  await db.exercises.add(e)
  return e
}

/** Слияние дублей: история переписывается на основное упражнение, имя дубля становится синонимом */
export async function mergeExercises(fromId: string, toId: string) {
  if (fromId === toId) return
  await db.transaction('rw', db.exercises, db.workouts, db.settings, async () => {
    const from = await db.exercises.get(fromId)
    const to = await db.exercises.get(toId)
    if (!from || !to) return
    const aliases = new Set([...to.aliases, from.name, ...from.aliases].filter(a => normalize(a) !== normalize(to.name)))
    await db.exercises.put({ ...to, aliases: [...aliases] })
    await db.exercises.put({ ...from, archived: true, mergedInto: toId })
    await db.workouts.toCollection().modify(w => {
      for (const e of w.exercises) if (e.exerciseId === fromId) e.exerciseId = toId
    })
    const s = await getSettings()
    if (s.keyLifts.includes(fromId)) {
      await db.settings.put({ key: 'keyLifts', value: [...new Set(s.keyLifts.map(id => (id === fromId ? toId : id)))] })
    }
  })
}

export async function addExerciseToWorkout(workoutId: string, exerciseId: string) {
  const w = await db.workouts.get(workoutId)
  if (!w) return
  // Количество подходов и веса — как в прошлый раз
  const prev = await lastPerformance(exerciseId, w.date)
  const sets = prev ? prev.sets.filter(s => s.done).map(s => newSet(s.w, s.r)) : [newSet(), newSet(), newSet()]
  await updateWorkout(workoutId, x => { x.exercises.push({ id: uid(), exerciseId, sets: sets.length ? sets : [newSet()] }) })
}

/** Последнее выполнение упражнения до даты (для подсказки «Прошлый раз») */
export async function lastPerformance(exerciseId: string, beforeDate: string) {
  const list = (await db.workouts.where('date').below(beforeDate).sortBy('date')).reverse()
  for (const w of list) {
    const e = w.exercises.find(x => x.exerciseId === exerciseId && x.sets.some(s => s.done))
    if (e) return { date: w.date, sets: e.sets }
  }
  return undefined
}

export async function setBodyWeight(date: string, kg: number) {
  await db.body.put({ date, kg })
}

export async function wipeAll() {
  await db.transaction('rw', [db.workouts, db.body, db.settings, db.exercises], async () => {
    await Promise.all([db.workouts.clear(), db.body.clear(), db.settings.clear(), db.exercises.clear()])
    await db.exercises.bulkAdd(CATALOG)
  })
}
