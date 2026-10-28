import 'fake-indexeddb/auto'
import { db } from './db'
import { addExerciseToWorkout, createWorkout, ensureExercise, finishWorkout, mergeExercises, startWorkout, toggleSet, autoFinishStale, findTemplate } from './repo'
import { buildBackup } from './backup'
import { AUTO_FINISH_MS } from '../domain/workout'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

it('в новой базе есть справочник', async () => {
  expect(await db.exercises.get('bench-press')).toBeTruthy()
})

it('не создаёт дубль упражнения по синониму или с другой буквой ё', async () => {
  const before = await db.exercises.count()
  const e = await ensureExercise('жим лежа')
  expect(e.id).toBe('bench-press')
  expect(await db.exercises.count()).toBe(before)
})

it('первый отмеченный подход запускает тренировку; одна активная за раз', async () => {
  const a = await createWorkout('2026-10-27', 'Ноги')
  const b = await createWorkout('2026-10-28', 'Спина')
  await addExerciseToWorkout(a.id, 'squat')
  await addExerciseToWorkout(b.id, 'deadlift')
  const wa = (await db.workouts.get(a.id))!
  await toggleSet(a.id, wa.exercises[0].id, wa.exercises[0].sets[0].id)
  expect((await db.workouts.get(a.id))!.status).toBe('active')
  await startWorkout(b.id)
  expect((await db.workouts.get(a.id))!.status).toBe('done')
  expect((await db.workouts.get(b.id))!.status).toBe('active')
})

it('автозавершение через час без подходов', async () => {
  const w = await createWorkout('2026-10-28', 'Грудь')
  await addExerciseToWorkout(w.id, 'bench-press')
  const x = (await db.workouts.get(w.id))!
  await toggleSet(w.id, x.exercises[0].id, x.exercises[0].sets[0].id)
  const last = (await db.workouts.get(w.id))!.lastActivityAt!
  expect(await autoFinishStale(last + AUTO_FINISH_MS + 1)).toBe(1)
  const done = (await db.workouts.get(w.id))!
  expect(done.status).toBe('done')
  expect(done.finishedAt).toBe(last)
})

it('слияние переписывает историю и добавляет синоним', async () => {
  const dup = await ensureExercise('Жим лёжа широким')
  const w = await createWorkout('2026-10-20', 'Грудь')
  await addExerciseToWorkout(w.id, dup.id)
  await mergeExercises(dup.id, 'bench-press')
  expect((await db.workouts.get(w.id))!.exercises[0].exerciseId).toBe('bench-press')
  expect((await db.exercises.get('bench-press'))!.aliases).toContain('Жим лёжа широким')
  expect((await db.exercises.get(dup.id))!.archived).toBe(true)
  expect((await ensureExercise('жим лежа широким')).id).toBe('bench-press')
})

it('шаблон — последняя тренировка с тем же названием, вес переносится', async () => {
  const old = await createWorkout('2026-10-01', 'Грудь / Трицепс')
  await addExerciseToWorkout(old.id, 'bench-press')
  const o = (await db.workouts.get(old.id))!
  o.exercises[0].sets[0] = { ...o.exercises[0].sets[0], w: 90, r: 8, done: true }
  await db.workouts.put(o)
  await finishWorkout(old.id)
  const tpl = await findTemplate('грудь / трицепс', '2026-10-28')
  expect(tpl?.id).toBe(old.id)
  const next = await createWorkout('2026-10-28', 'Грудь / Трицепс', { templateId: tpl!.id })
  expect(next.exercises[0].sets[0]).toMatchObject({ w: 90, r: 8, done: false })
})

it('копия содержит все таблицы', async () => {
  await createWorkout('2026-10-28', 'Ноги')
  const b = await buildBackup()
  expect(b.workouts).toHaveLength(1)
  expect(b.exercises.length).toBeGreaterThan(30)
})
