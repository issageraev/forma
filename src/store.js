import { useCallback, useEffect, useState } from 'react'

const KEY = 'forma.v1'

/* ---------- даты ---------- */
export const pad = n => String(n).padStart(2, '0')
export const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const startOfWeek = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return addDays(x, -((x.getDay() + 6) % 7)) }
export const uid = () => Math.random().toString(36).slice(2, 10)
export const fmt = (n, d = 1) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: d })

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const DOW = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
export const DOW_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
export const fmtLong = d => `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
export const fmtShort = d => `${DOW_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
export const fmtDay = k => { const d = parseKey(k); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` }

/* ---------- справочники ---------- */
export const LIBRARY = {
  'Грудь': ['Жим лёжа', 'Жим гантелей на наклонной', 'Разводка гантелей', 'Отжимания на брусьях', 'Сведения в кроссовере'],
  'Спина': ['Становая тяга', 'Подтягивания', 'Тяга штанги в наклоне', 'Тяга верхнего блока', 'Тяга гантели одной рукой'],
  'Ноги': ['Присед', 'Жим ногами', 'Румынская тяга', 'Выпады', 'Разгибания ног', 'Подъём на носки'],
  'Плечи': ['Жим стоя', 'Жим гантелей сидя', 'Махи в стороны', 'Тяга к подбородку', 'Обратные разводки'],
  'Руки': ['Подъём штанги на бицепс', 'Молотки', 'Французский жим', 'Разгибания на блоке', 'Жим узким хватом'],
}
export const CATEGORIES = Object.keys(LIBRARY)
export const CATEGORY_OF = Object.fromEntries(Object.entries(LIBRARY).flatMap(([c, list]) => list.map(n => [n, c])))
export const KEY_LIFTS = [
  { name: 'Жим лёжа', short: 'Жим' },
  { name: 'Присед', short: 'Присед' },
  { name: 'Становая тяга', short: 'Тяга' },
  { name: 'Жим стоя', short: 'Стоя' },
]
export const TITLE_PRESETS = ['Грудь / Трицепс', 'Спина / Бицепс', 'Ноги', 'Плечи', 'Спина / Плечи', 'Руки', 'Фулбади']

/* ---------- метрики ---------- */
export const doneOf = ex => ex.sets.filter(s => s.done)
export const topSet = ex => Math.max(0, ...doneOf(ex).map(s => +s.w || 0))
export const volume = w => w.exercises.reduce((a, ex) => a + doneOf(ex).reduce((b, s) => b + (+s.w || 0) * (+s.r || 0), 0), 0)
export const doneSets = w => w.exercises.reduce((a, ex) => a + doneOf(ex).length, 0)
export const duration = w => (w.startedAt && w.finishedAt ? Math.round((new Date(w.finishedAt) - new Date(w.startedAt)) / 60000) : null)
export const fmtMin = m => (m == null ? '—' : `${Math.floor(m / 60)}:${pad(m % 60)}`)

export function dayStatus(w, key) {
  if (!w || (!w.title && !w.exercises.length)) return 'empty'
  if (w.status === 'done') return 'done'
  if (w.status === 'active') return 'active'
  return key < dkey() ? 'missed' : 'planned'
}
export const STATUS_LABEL = { done: 'Завершена', active: 'В процессе', planned: 'Запланирована', missed: 'Пропущена', empty: 'Свободно' }

const sorted = data => Object.entries(data.workouts).sort(([a], [b]) => (a < b ? -1 : 1))
export const lastDone = data => sorted(data).filter(([, w]) => w.status === 'done').at(-1)

export const liftHistory = (data, name) =>
  sorted(data)
    .filter(([, w]) => w.status === 'done')
    .map(([date, w]) => { const ex = w.exercises.find(e => e.name === name); return ex ? { date, top: topSet(ex) } : null })
    .filter(x => x && x.top > 0)

export function previousExercise(data, name, beforeKey) {
  for (const [date, w] of sorted(data).filter(([k]) => k < beforeKey).reverse()) {
    const ex = w.exercises.find(e => e.name === name && e.sets.some(s => s.done))
    if (ex) return { date, ex }
  }
  return null
}

export function previousByTitle(data, title, beforeKey) {
  if (!title) return null
  const t = title.trim().toLowerCase()
  return sorted(data).filter(([k, w]) => k < beforeKey && w.title?.trim().toLowerCase() === t && w.exercises.length).at(-1) || null
}

export const latestWeight = data => data.weightLog.at(-1)?.kg ?? null

/* ---------- демо-данные ---------- */
function seed() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const mon = startOfWeek(today)
  const plan = [
    { dow: 0, title: 'Грудь / Трицепс', ex: [['Жим лёжа', 80, 2.5, 8], ['Жим гантелей на наклонной', 28, 1, 10], ['Отжимания на брусьях', 10, 2.5, 10], ['Французский жим', 30, 1.25, 12]] },
    { dow: 1, title: 'Спина / Бицепс', ex: [['Становая тяга', 130, 5, 5], ['Подтягивания', 5, 2.5, 8], ['Тяга штанги в наклоне', 65, 2.5, 10], ['Подъём штанги на бицепс', 32.5, 1.25, 10]] },
    { dow: 3, title: 'Ноги', ex: [['Присед', 105, 5, 6], ['Жим ногами', 180, 10, 12], ['Румынская тяга', 85, 2.5, 10]] },
    { dow: 4, title: 'Плечи', ex: [['Жим стоя', 47.5, 2.5, 8], ['Махи в стороны', 10, 1, 15], ['Тяга к подбородку', 32.5, 1.25, 12]] },
  ]
  const workouts = {}
  const weightLog = []
  for (let wk = 5; wk >= 0; wk--) {
    const i = 5 - wk
    const step = i === 3 ? i - 1 : i // неделя-откат для реалистичного графика
    const bw = +(84.2 - i * 0.36).toFixed(1)
    weightLog.push({ date: dkey(addDays(mon, -wk * 7)), kg: bw })
    for (const p of plan) {
      const day = addDays(mon, -wk * 7 + p.dow)
      if (day >= today) continue
      const start = new Date(day); start.setHours(19, 5)
      workouts[dkey(day)] = {
        title: p.title, status: 'done', bodyWeight: bw,
        startedAt: start.toISOString(), finishedAt: new Date(+start + (62 + p.dow * 4) * 60000).toISOString(),
        exercises: p.ex.map(([name, base, inc, reps]) => ({
          id: uid(), name,
          sets: Array.from({ length: 4 }, (_, s) => ({ id: uid(), w: +(base + inc * step).toFixed(2), r: s === 3 ? reps - 2 : reps, done: true })),
        })),
      }
    }
  }
  workouts[dkey(addDays(mon, 7))] = { title: 'Грудь / Трицепс', status: 'planned', bodyWeight: null, exercises: [] }

  const water = {}
  for (let d = 1; d <= 13; d++) water[dkey(addDays(today, -d))] = [2250, 2750, 3000, 2500, 3250, 1750, 2750][d % 7]
  water[dkey(today)] = 1250

  return { v: 1, profile: { height: 182, waterGoal: 3000, rest: 90 }, weightLog, water, workouts, custom: [] }
}

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch { /* приватный режим */ }
  return seed()
}

export function useStore() {
  const [data, setData] = useState(load)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* нет места */ } }, [data])
  const update = useCallback(fn => setData(d => { const next = structuredClone(d); fn(next); return next }), [])
  const reset = useCallback(() => setData(seed()), [])
  return { data, update, reset }
}
