import { parseNum, sanitizeDecimal } from './numbers'
import { CATALOG, findExact, findSimilar, normalize, resolveId, search } from './exercises'
import { changePct, currentLevel, e1rm, sessionE1rm, strengthSeries, workingSets } from './strength'
import { AUTO_FINISH_MS, autoFinishPatch, dayStatus, pruneOnFinish } from './workout'
import { monthGrid } from './dates'
import type { Exercise, SetEntry, Workout } from './types'

const set = (w: number | null, r: number | null, done = true): SetEntry => ({ id: Math.random().toString(36), w, r, done })
const workout = (date: string, exerciseId: string, sets: SetEntry[], extra: Partial<Workout> = {}): Workout => ({
  id: date, date, title: 'Тест', status: 'done', exercises: [{ id: 'x', exerciseId, sets }], createdAt: 0, updatedAt: 0, ...extra,
})

describe('ввод чисел', () => {
  it('понимает запятую и точку', () => {
    expect(parseNum('82,5')).toBe(82.5)
    expect(parseNum('82.5')).toBe(82.5)
    expect(parseNum(' 100 ')).toBe(100)
  })
  it('пустое и мусор → null', () => {
    expect(parseNum('')).toBeNull()
    expect(parseNum(',')).toBeNull()
    expect(parseNum('abc')).toBeNull()
  })
  it('поле ввода держит одну запятую и 2 знака', () => {
    expect(sanitizeDecimal('82.555')).toBe('82,55')
    expect(sanitizeDecimal('8a2,5,1')).toBe('82,51')
  })
})

describe('справочник упражнений', () => {
  it('нормализует ё, регистр и пробелы', () => {
    expect(normalize('  Жим   ЛЁЖА! ')).toBe('жим лежа')
  })
  it('находит по синониму без учёта ё', () => {
    expect(findExact(CATALOG, 'жим лежа')?.id).toBe('bench-press')
    expect(findExact(CATALOG, 'Приседания со штангой')?.id).toBe('squat')
  })
  it('ловит опечатку и перестановку слов', () => {
    expect(findSimilar(CATALOG, 'Жим лежо')?.id).toBe('bench-press')
    expect(findSimilar(CATALOG, 'тяга становая')).toBeUndefined() // это точный синоним, не «похожее»
    expect(findSimilar(CATALOG, 'лежа жим')?.id).toBe('bench-press')
    expect(findSimilar(CATALOG, 'Становая тяга сумо')?.id).toBe('deadlift')
  })
  it('не предлагает похожее для совсем другого', () => {
    expect(findSimilar(CATALOG, 'Бёрпи')).toBeUndefined()
  })
  it('поиск ставит совпадение по началу выше', () => {
    expect(search(CATALOG, 'жим')[0].name.startsWith('Жим')).toBe(true)
  })
  it('цепочка слияний ведёт к итоговому упражнению', () => {
    const list: Exercise[] = [
      { id: 'a', name: 'A', aliases: [], category: 'Грудь', kind: 'weight', archived: true, mergedInto: 'b' },
      { id: 'b', name: 'B', aliases: [], category: 'Грудь', kind: 'weight', archived: true, mergedInto: 'c' },
      { id: 'c', name: 'C', aliases: [], category: 'Грудь', kind: 'weight' },
    ]
    expect(resolveId(list, 'a')).toBe('c')
  })
})

describe('силовой индекс', () => {
  it('формула Эпли', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(90, 5)).toBeCloseTo(105)
    expect(e1rm(60, 15)).toBeNull()
  })
  it('90×5 и 80×10 сравнимы через 1ПМ', () => {
    expect(e1rm(80, 10)!).toBeGreaterThan(e1rm(90, 5)!)
  })
  it('разминка не считается', () => {
    const sets = [set(40, 10), set(60, 8), set(100, 5), set(100, 5)]
    expect(workingSets(sets, 'weight').map(s => s.w)).toEqual([60, 100, 100])
    expect(sessionE1rm(sets, 'weight')).toBeCloseTo(100 * (1 + 5 / 30))
  })
  it('невыполненные подходы не считаются', () => {
    expect(sessionE1rm([set(200, 5, false), set(100, 5)], 'weight')).toBeCloseTo(100 * (1 + 5 / 30))
  })
  it('свой вес учитывается для подтягиваний', () => {
    expect(sessionE1rm([set(10, 5)], 'bodyweight', 80)).toBeCloseTo(90 * (1 + 5 / 30))
    expect(sessionE1rm([set(10, 5)], 'bodyweight', null)).toBeNull()
  })
  it('медиана последних трёх гасит один плохой день', () => {
    const bench = CATALOG.find(e => e.id === 'bench-press')!
    const ws = [
      workout('2026-10-01', 'bench-press', [set(80, 8)]),
      workout('2026-10-08', 'bench-press', [set(85, 8)]),
      workout('2026-10-15', 'bench-press', [set(60, 8)]), // плохой день
      workout('2026-10-22', 'bench-press', [set(87.5, 8)]),
    ]
    const series = strengthSeries(ws, bench)
    expect(series).toHaveLength(4)
    expect(currentLevel(series)).toBeCloseTo(e1rm(85, 8)!)
    expect(changePct(series, '2026-10-01')!).toBeGreaterThan(0)
  })
})

describe('жизненный цикл тренировки', () => {
  const now = Date.UTC(2026, 9, 28, 20)
  const active = (extra: Partial<Workout>) => workout('2026-10-28', 'squat', [set(100, 5)], { status: 'active', startedAt: now - 2 * AUTO_FINISH_MS, ...extra })

  it('через час без подходов завершается временем последнего подхода', () => {
    const last = now - AUTO_FINISH_MS - 1000
    expect(autoFinishPatch(active({ lastActivityAt: last }), now)).toEqual({ status: 'done', finishedAt: last, autoFinished: true })
  })
  it('меньше часа — не трогаем', () => {
    expect(autoFinishPatch(active({ lastActivityAt: now - 10 * 60000 }), now)).toBeNull()
  })
  it('без единого подхода возвращается в план', () => {
    const w = workout('2026-10-28', 'squat', [set(null, null, false)], { status: 'active', startedAt: now - 2 * AUTO_FINISH_MS })
    expect(autoFinishPatch(w, now)?.status).toBe('planned')
  })
  it('прошедший план — пропущена', () => {
    expect(dayStatus(workout('2026-10-20', 'squat', [], { status: 'planned' }), '2026-10-28')).toBe('missed')
  })
  it('при завершении чистит пустые подходы и упражнения', () => {
    const w = workout('2026-10-28', 'squat', [set(100, 5), set(null, null, false)])
    w.exercises.push({ id: 'y', exerciseId: 'ohp', sets: [set(null, null, false)] })
    const ex = pruneOnFinish(w)
    expect(ex).toHaveLength(1)
    expect(ex[0].sets).toHaveLength(1)
  })
})

describe('календарь', () => {
  it('октябрь 2026 начинается с 28 сентября и занимает 5 недель', () => {
    const g = monthGrid(2026, 9)
    expect(g[0][0].key).toBe('2026-09-28')
    expect(g).toHaveLength(5)
  })
})
