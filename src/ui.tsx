import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { DayStatus } from './domain/types'
import { STATUS_LABEL } from './domain/workout'
import { parseNum, sanitizeDecimal, toInput } from './domain/numbers'

const PATHS = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  dumbbell: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  scale: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM8.5 10a5 5 0 0 1 7 0M12 10l1.2-1.6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  play: 'M8 5.5v13l10-6.5z',
  repeat: 'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  merge: 'M6 4v5a5 5 0 0 0 5 5h7M15 11l3 3-3 3M6 20v-3',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18, stroke = 1.9 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

export function Badge({ status, children }: { status: DayStatus | 'empty'; children?: ReactNode }) {
  return <span className={`badge badge-${status}`}><i />{children ?? STATUS_LABEL[status]}</span>
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className={`sheet ${wide ? 'wide' : ''}`} onClick={e => e.stopPropagation()} role="dialog" aria-modal>
        <div className="sheet-grip" />
        {title != null && (
          <div className="sheet-head">
            <div className="sheet-title">{title}</div>
            <button className="icon-btn sm" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={16} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(o => <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  )
}

export function Sparkline({ values, width = 76, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="spark-empty">—</span>
  const mn = Math.min(...values), mx = Math.max(...values)
  const pts = values.map((v, i) => [2 + (i * (width - 4)) / (values.length - 1), 2 + (1 - (v - mn) / (mx - mn || 1)) * (height - 4)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="3" fill="var(--orange)" />
    </svg>
  )
}

/** Штрихкод-спарклайн из референса */
export function Barcode({ values, bars = 40 }: { values: number[]; bars?: number }) {
  const min = Math.min(...values), max = Math.max(...values)
  const hs = Array.from({ length: bars }, (_, i) => {
    if (!values.length) return 0.3
    const t = (i / (bars - 1)) * (values.length - 1)
    const a = values[Math.floor(t)], b = values[Math.ceil(t)]
    const v = a + (b - a) * (t - Math.floor(t))
    return 0.25 + (max === min ? 0.3 : ((v - min) / (max - min)) * 0.55) + (Math.sin(i * 2.7) + 1) * 0.05
  })
  const from = Math.round(bars * 0.55), to = from + Math.round(bars * 0.25)
  return <div className="barcode">{hs.map((h, i) => <span key={i} className={i >= from && i < to ? 'hot' : ''} style={{ height: `${(i >= from && i < to ? 1 : h * 0.7) * 100}%` }} />)}</div>
}

/**
 * Поле числа для iPhone: цифровая клавиатура с запятой, шрифт ≥16px (без зума Safari),
 * сохраняет на каждом вводе, «Далее» на клавиатуре переводит фокус.
 */
export function NumberField({ value, onCommit, placeholder, integer, inputRef, onEnter, enterKeyHint = 'next', className = '', ariaLabel }: {
  value: number | null | undefined
  onCommit: (n: number | null) => void
  placeholder?: string
  integer?: boolean
  inputRef?: RefObject<HTMLInputElement>
  onEnter?: () => void
  enterKeyHint?: 'next' | 'done'
  className?: string
  ariaLabel?: string
}) {
  const [text, setText] = useState(toInput(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setText(toInput(value)) }, [value])
  return (
    <input
      ref={inputRef}
      className={`num ${className}`}
      aria-label={ariaLabel}
      inputMode={integer ? 'numeric' : 'decimal'}
      pattern={integer ? '[0-9]*' : undefined}
      enterKeyHint={enterKeyHint}
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      onFocus={e => { focused.current = true; e.currentTarget.select() }}
      onBlur={() => { focused.current = false; setText(toInput(value)) }}
      onChange={e => {
        const t = integer ? e.target.value.replace(/\D/g, '').slice(0, 4) : sanitizeDecimal(e.target.value)
        setText(t)
        onCommit(parseNum(t))
      }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnter ? onEnter() : e.currentTarget.blur() } }}
    />
  )
}

/* ---------- тосты с «Отменить» ---------- */
interface ToastItem { id: number; text: string; action?: { label: string; run: () => void } }
const ToastCtx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems(xs => [...xs.slice(-1), { ...t, id }])
    setTimeout(() => setItems(xs => xs.filter(x => x.id !== id)), t.action ? 6000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map(t => (
          <div key={t.id} className="toast">
            <span>{t.text}</span>
            {t.action && <button onClick={() => { t.action!.run(); setItems(xs => xs.filter(x => x.id !== t.id)) }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const confirmAsk = (text: string) => window.confirm(text)
