import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

export type ThemePref = 'light' | 'dark' | 'system'
type Theme = 'light' | 'dark'

const KEY = 'forma.theme'
const META_COLOR: Record<Theme, string> = { light: '#E8E9E5', dark: '#15180F' }
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

export const readPref = (): ThemePref => {
  try { return (localStorage.getItem(KEY) as ThemePref) || 'light' } catch { return 'light' }
}
const resolve = (p: ThemePref): Theme => (p === 'system' ? (systemDark() ? 'dark' : 'light') : p)

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme])
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Плавная смена темы: круг новой темы расходится от точки нажатия (View Transitions), иначе — мгновенно */
function animateTo(theme: Theme, origin?: { x: number; y: number }) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> } }
  if (!doc.startViewTransition || reduceMotion()) { apply(theme); return }
  const root = document.documentElement
  root.classList.add('theme-switch')
  const t = doc.startViewTransition(() => apply(theme))
  t.updateCallbackDone.catch(() => {})
  const x = origin?.x ?? window.innerWidth - 40, y = origin?.y ?? 60
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  t.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => {})
  t.finished.catch(() => {}).finally(() => root.classList.remove('theme-switch'))
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(readPref)
  const [theme, setTheme] = useState<Theme>(() => resolve(readPref()))

  useEffect(() => {
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => { const t = resolve('system'); setTheme(t); animateTo(t) }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [pref])

  const setPref = useCallback((p: ThemePref, origin?: { x: number; y: number }) => {
    try { localStorage.setItem(KEY, p) } catch { /* приватный режим */ }
    const next = resolve(p)
    setPrefState(p)
    setTheme(next)
    animateTo(next, origin)
  }, [])

  const toggle = useCallback((origin?: { x: number; y: number }) => setPref(theme === 'dark' ? 'light' : 'dark', origin), [theme, setPref])
  return { pref, theme, setPref, toggle }
}

/** Плавная смена экрана: перекрёстное появление через View Transitions (iOS 18+), иначе обычная анимация */
export function navigate(update: () => void) {
  type VT = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => VT }
  if (!doc.startViewTransition || reduceMotion() || document.visibilityState !== 'visible') { update(); return }
  // Быстрые повторные нажатия прерывают предыдущий переход — это нормально, ошибку гасим
  const t = doc.startViewTransition(() => flushSync(update))
  for (const p of [t.ready, t.finished, t.updateCallbackDone]) p.catch(() => {})
}

export const supportsViewTransitions = () => 'startViewTransition' in document
