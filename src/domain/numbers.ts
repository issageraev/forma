/** Разбирает ввод с iPhone-клавиатуры: «82,5», «82.5», « 82 » → число; пусто/мусор → null */
export function parseNum(input: string | number | null | undefined): number | null {
  if (input == null) return null
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  const s = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!s || !/^\d*\.?\d*$/.test(s) || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Оставляет в поле только цифры и одну запятую (до 2 знаков после), пока человек печатает */
export function sanitizeDecimal(input: string) {
  const s = input.replace(/[^\d.,]/g, '').replace(/\./g, ',')
  const [int, ...rest] = s.split(',')
  return rest.length ? `${int},${rest.join('').slice(0, 2)}` : int
}

export const fmt = (n: number, digits = 1) => n.toLocaleString('ru-RU', { maximumFractionDigits: digits })

/** Число для поля ввода: 82.5 → «82,5» */
export const toInput = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','))

export const roundTo = (n: number, step: number) => Math.round(n / step) * step
