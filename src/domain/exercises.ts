import type { Category, Exercise, ExerciseKind } from './types'

/** Нормализация для поиска и защиты от дублей: регистр, ё/е, пунктуация, лишние пробелы */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

const namesOf = (e: Exercise) => [e.name, ...e.aliases].map(normalize)
const active = (list: Exercise[]) => list.filter(e => !e.archived)

/** Точное совпадение по имени или синониму (после нормализации) */
export function findExact(list: Exercise[], query: string): Exercise | undefined {
  const q = normalize(query)
  if (!q) return undefined
  return active(list).find(e => namesOf(e).includes(q))
}

/** Поиск для пикера: совпадения по началу слов выше, чем по подстроке */
export function search(list: Exercise[], query: string, category?: Category): Exercise[] {
  const q = normalize(query)
  const pool = active(list).filter(e => !category || e.category === category)
  if (!q) return [...pool].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  const scored = pool
    .map(e => {
      const names = namesOf(e)
      const score = names.some(n => n === q) ? 0
        : names.some(n => n.startsWith(q)) ? 1
        : names.some(n => n.split(' ').some(w => w.startsWith(q))) ? 2
        : names.some(n => n.includes(q)) ? 3
        : 9
      return { e, score }
    })
    .filter(x => x.score < 9)
  if (scored.length) return scored.sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name, 'ru')).map(x => x.e)
  return looseSearch(pool, q)
}

/** Запасной поиск при опечатках: совпадение отдельных слов с точностью до одной буквы */
function looseSearch(pool: Exercise[], q: string): Exercise[] {
  const qWords = q.split(' ').filter(w => w.length >= 2)
  const wordMatch = (qw: string, nw: string) => nw.startsWith(qw) || (qw.length >= 4 && levenshtein(qw, nw.slice(0, qw.length)) <= 1)
  return pool
    .map(e => {
      const words = namesOf(e).flatMap(n => n.split(' '))
      return { e, hits: qWords.filter(qw => words.some(nw => wordMatch(qw, nw))).length }
    })
    .filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.e.name.length - b.e.name.length)
    .map(x => x.e)
}

/**
 * Похожее упражнение для вопроса «Это оно?» перед созданием нового.
 * Ловит опечатки («жим лежо»), перестановку слов и лишние слова («жим штанги лёжа»).
 */
export function findSimilar(list: Exercise[], query: string): Exercise | undefined {
  const q = normalize(query)
  if (q.length < 3 || findExact(list, query)) return undefined
  const qWords = q.split(' ').sort().join(' ')
  let best: { e: Exercise; d: number } | undefined
  for (const e of active(list)) {
    for (const n of namesOf(e)) {
      const sortedWords = n.split(' ').sort().join(' ')
      if (sortedWords === qWords) return e
      const d = levenshtein(q, n)
      const limit = Math.max(1, Math.floor(n.length / 6))
      const contains = (n.length >= 5 && q.includes(n)) || (q.length >= 5 && n.includes(q))
      const score = contains ? 0.5 : d
      if ((contains || d <= limit) && (!best || score < best.d)) best = { e, d: score }
    }
  }
  return best?.e
}

/** Слияние: id упражнения, на которое теперь ссылается история (с учётом цепочек слияний) */
export function resolveId(list: Exercise[], id: string): string {
  const byId = new Map(list.map(e => [e.id, e]))
  let cur = byId.get(id)
  const seen = new Set<string>()
  while (cur?.mergedInto && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.mergedInto) }
  return cur?.id ?? id
}

type Seed = [id: string, name: string, category: Category, kind: ExerciseKind, aliases?: string[]]

const SEED: Seed[] = [
  ['bench-press', 'Жим лёжа', 'Грудь', 'weight', ['жим штанги лежа', 'жим лежа штанги', 'жим на горизонтальной скамье']],
  ['incline-db-press', 'Жим гантелей на наклонной', 'Грудь', 'weight', ['жим гантелей наклонная', 'наклонный жим гантелей']],
  ['incline-bench', 'Жим штанги на наклонной', 'Грудь', 'weight', ['наклонный жим штанги']],
  ['db-press', 'Жим гантелей лёжа', 'Грудь', 'weight'],
  ['db-fly', 'Разводка гантелей', 'Грудь', 'weight', ['разводы гантелей', 'разведения гантелей лежа']],
  ['dips', 'Отжимания на брусьях', 'Грудь', 'bodyweight', ['брусья']],
  ['cable-crossover', 'Сведения в кроссовере', 'Грудь', 'weight', ['кроссовер']],
  ['push-ups', 'Отжимания', 'Грудь', 'bodyweight', ['отжимания от пола']],
  ['deadlift', 'Становая тяга', 'Спина', 'weight', ['становая', 'тяга становая']],
  ['pull-ups', 'Подтягивания', 'Спина', 'bodyweight', ['подтягивания на турнике']],
  ['barbell-row', 'Тяга штанги в наклоне', 'Спина', 'weight', ['тяга в наклоне', 'тяга штанги к поясу']],
  ['lat-pulldown', 'Тяга верхнего блока', 'Спина', 'weight', ['верхний блок', 'тяга вертикального блока']],
  ['seated-row', 'Тяга нижнего блока', 'Спина', 'weight', ['горизонтальная тяга', 'тяга горизонтального блока']],
  ['db-row', 'Тяга гантели одной рукой', 'Спина', 'weight', ['тяга гантели в наклоне']],
  ['hyperextension', 'Гиперэкстензия', 'Спина', 'bodyweight'],
  ['squat', 'Присед', 'Ноги', 'weight', ['приседания', 'приседания со штангой', 'присед со штангой']],
  ['leg-press', 'Жим ногами', 'Ноги', 'weight', ['платформа']],
  ['rdl', 'Румынская тяга', 'Ноги', 'weight', ['мертвая тяга']],
  ['lunges', 'Выпады', 'Ноги', 'weight'],
  ['leg-extension', 'Разгибания ног', 'Ноги', 'weight', ['разгибание ног в тренажере']],
  ['leg-curl', 'Сгибания ног', 'Ноги', 'weight', ['сгибание ног в тренажере']],
  ['calf-raise', 'Подъём на носки', 'Ноги', 'weight', ['икры']],
  ['ohp', 'Жим стоя', 'Плечи', 'weight', ['армейский жим', 'жим штанги стоя']],
  ['db-shoulder-press', 'Жим гантелей сидя', 'Плечи', 'weight', ['жим гантелей на плечи']],
  ['lateral-raise', 'Махи в стороны', 'Плечи', 'weight', ['разводка в стороны', 'махи гантелями']],
  ['upright-row', 'Тяга к подбородку', 'Плечи', 'weight'],
  ['rear-delt-fly', 'Обратные разводки', 'Плечи', 'weight', ['задняя дельта']],
  ['barbell-curl', 'Подъём штанги на бицепс', 'Руки', 'weight', ['бицепс со штангой', 'сгибания со штангой']],
  ['hammer-curl', 'Молотки', 'Руки', 'weight', ['молот']],
  ['db-curl', 'Подъём гантелей на бицепс', 'Руки', 'weight', ['бицепс с гантелями']],
  ['skull-crusher', 'Французский жим', 'Руки', 'weight'],
  ['triceps-pushdown', 'Разгибания на блоке', 'Руки', 'weight', ['трицепс на блоке']],
  ['close-grip-bench', 'Жим узким хватом', 'Руки', 'weight'],
  ['plank', 'Планка', 'Пресс', 'time'],
  ['crunches', 'Скручивания', 'Пресс', 'bodyweight', ['пресс']],
  ['hanging-leg-raise', 'Подъём ног в висе', 'Пресс', 'bodyweight'],
]

export const CATALOG: Exercise[] = SEED.map(([id, name, category, kind, aliases = []]) => ({ id, name, category, kind, aliases }))
export const DEFAULT_KEY_LIFTS = ['bench-press', 'squat', 'deadlift', 'ohp']
export const CATEGORIES: Category[] = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Пресс', 'Другое']

/** Цвет дня в календаре по названию тренировки */
export function titleColor(title: string): 'orange' | 'violet' | 'green' | 'amber' | 'pink' | 'dark' {
  const t = normalize(title)
  if (/груд/.test(t)) return 'orange'
  if (/спин/.test(t)) return 'violet'
  if (/ног|присед/.test(t)) return 'green'
  if (/плеч/.test(t)) return 'amber'
  if (/рук|бицепс|трицепс/.test(t)) return 'pink'
  return 'dark'
}
