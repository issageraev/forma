import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Icon, useToast, type IconName } from './ui'
import { useBody, useExercises, useSettings, useWorkoutIndex, useWorkouts } from './db/hooks'
import { requestPersistence } from './db/db'
import { autoFinishStale } from './db/repo'
import { HomeScreen } from './screens/HomeScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { NoWorkout, WorkoutView } from './screens/WorkoutScreen'
import { AnalyticsScreen } from './screens/AnalyticsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { navigate, supportsViewTransitions, useTheme } from './theme'

type Tab = 'home' | 'calendar' | 'workout' | 'analytics'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Главная', icon: 'grid' },
  { id: 'calendar', label: 'Календарь', icon: 'calendar' },
  { id: 'workout', label: 'Тренировка', icon: 'dumbbell' },
  { id: 'analytics', label: 'Аналитика', icon: 'chart' },
]

/** Таб-бар с «пилюлей», которая плавно переезжает к выбранному разделу */
function TabBar({ tab, onTab, activeDot }: { tab: Tab | null; onTab: (t: Tab) => void; activeDot: boolean }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = tab ? refs.current[tab] : null
      setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null)
    }
    measure()
    document.fonts?.ready.then(measure)
  }, [tab])
  return (
    <nav className="tabbar">
      {pill && <span className="indicator" style={{ width: pill.w, transform: `translateX(${pill.x}px)` }} />}
      {TABS.map(t => (
        <button key={t.id} ref={el => { refs.current[t.id] = el }} className={tab === t.id ? 'on' : ''} aria-label={t.label}
          aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab(t.id)}>
          <Icon name={t.icon} size={24} stroke={2} />
          {tab === t.id && <span className="label">{t.label}</span>}
          {t.id === 'workout' && activeDot && tab !== 'workout' && <span className="dot" />}
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const loaded = useWorkouts()
  const workouts = loaded ?? []
  const { list, byId } = useExercises()
  const settings = useSettings()
  const body = useBody()
  const idx = useWorkoutIndex(workouts)
  const toast = useToast()
  const theme = useTheme()
  const [tab, setTab] = useState<Tab>('home')
  const [focus, setFocus] = useState<{ id: string; from: Tab } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  const vt = supportsViewTransitions()

  // Жизненный цикл: при запуске, раз в минуту и при возврате в приложение закрываем «забытые» тренировки
  useEffect(() => {
    requestPersistence()
    const run = async () => {
      const n = await autoFinishStale()
      if (n) toast({ text: 'Тренировка завершена автоматически — через час после последнего подхода' })
    }
    run()
    const t = setInterval(run, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [toast])

  useEffect(() => { window.scrollTo(0, 0) }, [tab, focus?.id, settingsOpen])

  if (!loaded) return <div className="app" />

  const go = (fn: () => void) => navigate(fn)
  const openWorkout = (id: string) => go(() => { setSettingsOpen(false); setFocus({ id, from: tab === 'workout' ? 'workout' : tab }); setTab('workout') })
  const switchTab = (t: Tab) => go(() => { setSettingsOpen(false); setFocus(null); setTab(t) })
  const focused = focus ? workouts.find(w => w.id === focus.id) : undefined
  const current = focused ?? idx.active ?? idx.byDate.get(idx.today)
  const back = focused && focus && focus.from !== 'workout' ? () => go(() => { setTab(focus.from); setFocus(null) }) : undefined
  // Без View Transitions экран появляется собственной анимацией
  const key = `${settingsOpen ? 'settings' : tab}-${focus?.id ?? ''}`

  return (
    <div className="app">
      {needRefresh && !idx.active && (
        <div className="banner info update">
          <span className="grow">Доступна новая версия</span>
          <button className="pill sm dark" onClick={() => updateServiceWorker(true)}>Обновить</button>
        </div>
      )}

      <div key={key} className={vt ? '' : 'page enter'}>
        {settingsOpen ? (
          <SettingsScreen settings={settings} body={body} list={list} workouts={workouts}
            themePref={theme.pref} onTheme={p => theme.setPref(p)} onBack={() => go(() => setSettingsOpen(false))} />
        ) : tab === 'home' ? (
          <HomeScreen
            workouts={workouts} active={idx.active} upcoming={idx.upcoming} lastDone={idx.lastDone} body={body} exercises={byId} settings={settings}
            theme={theme.theme} onToggleTheme={theme.toggle}
            onOpen={openWorkout} onSettings={() => go(() => setSettingsOpen(true))} onTab={switchTab}
          />
        ) : tab === 'calendar' ? (
          <CalendarScreen workouts={workouts} byDate={idx.byDate} exercises={byId} settings={settings} titles={idx.titles} onOpen={openWorkout} />
        ) : tab === 'workout' ? (current
          ? <WorkoutView key={current.id} workout={current} workouts={workouts} exercises={byId} settings={settings} titles={idx.titles} onBack={back} />
          : <NoWorkout workouts={workouts} settings={settings} titles={idx.titles} today={idx.today} onOpen={id => go(() => setFocus({ id, from: 'workout' }))} />
        ) : (
          <AnalyticsScreen workouts={workouts} exercises={byId} settings={settings} />
        )}
      </div>

      <TabBar tab={settingsOpen ? null : tab} onTab={switchTab} activeDot={!!idx.active} />
    </div>
  )
}
