export const pad = (n: number) => String(n).padStart(2, '0')
export const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return addDays(x, -((x.getDay() + 6) % 7)) }
export const shiftKey = (k: string, days: number) => dkey(addDays(parseKey(k), days))

export const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const DOW = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
export const DOW_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
/** Порядок дней недели в интерфейсе: с понедельника */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const fmtLong = (k: string) => { const d = parseKey(k); return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}` }
export const fmtShort = (k: string) => { const d = parseKey(k); return `${DOW_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` }
export const fmtDay = (k: string) => { const d = parseKey(k); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` }

/** Относительная подпись: «Сегодня», «Завтра», «Вчера» или «Пт, 30 окт» */
export function fmtRelative(k: string, today = dkey()) {
  if (k === today) return 'Сегодня'
  if (k === shiftKey(today, 1)) return 'Завтра'
  if (k === shiftKey(today, -1)) return 'Вчера'
  return fmtShort(k)
}

/** Сетка месяца по неделям (Пн–Вс), включая хвосты соседних месяцев */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = startOfWeek(first)
  const weeks: { key: string; inMonth: boolean; day: number }[][] = []
  let cur = start
  while (weeks.length < 6) {
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(cur, i)
      return { key: dkey(d), inMonth: d.getMonth() === month, day: d.getDate() }
    })
    if (!week.some(c => c.inMonth)) break
    weeks.push(week)
    cur = addDays(cur, 7)
  }
  return weeks
}

export const fmtDuration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000))
  return `${Math.floor(m / 60)}:${pad(m % 60)}`
}
