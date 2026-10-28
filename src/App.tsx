import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Icon, useToast, type IconName } from './ui'
import { useBody, useExercises, useSettings, useWorkoutIndex, useWorkouts } from './db/hooks'
import { requestPersistence } from './db/db'
import { autoFinishStale } from './db/repo'
import { HomeScreen } from './screens/HomeScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { NoWorkout, WorkoutView } from './screens/WorkoutScreen'
import { AnalyticsScreen } from './screens/AnalyticsScreen'
import { SettingsSheet } from './screens/SettingsSheet'

type Tab = 'home' | 'calendar' | 'workout' | 'analytics'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Главная', icon: 'grid' },
  { id: 'calendar', label: 'Календарь', icon: 'calendar' },
  { id: 'workout', label: 'Тренировка', icon: 'dumbbell' },
  { id: 'analytics', label: 'Аналитика', icon: 'chart' },
]

export default function App() {
  const loaded = useWorkouts()
  const workouts = loaded ?? []
  const { list, byId } = useExercises()
  const settings = useSettings()
  const body = useBody()
  const idx = useWorkoutIndex(workouts)
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('home')
  const [focus, setFocus] = useState<{ id: string; from: Tab } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

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

  useEffect(() => { window.scrollTo(0, 0) }, [tab, focus?.id])

  if (!loaded) return <div className="app" />

  const openWorkout = (id: string) => { setFocus({ id, from: tab === 'workout' ? 'workout' : tab }); setTab('workout') }
  const focused = focus ? workouts.find(w => w.id === focus.id) : undefined
  const current = focused ?? idx.active ?? idx.byDate.get(idx.today)
  const back = focused && focus && focus.from !== 'workout' ? () => { setTab(focus.from); setFocus(null) } : undefined

  return (
    <div className="app">
      {needRefresh && !idx.active && (
        <div className="banner info update">
          <span className="grow">Доступна новая версия</span>
          <button className="pill sm dark" onClick={() => updateServiceWorker(true)}>Обновить</button>
        </div>
      )}

      {tab === 'home' && (
        <HomeScreen
          workouts={workouts} active={idx.active} upcoming={idx.upcoming} lastDone={idx.lastDone} body={body} exercises={byId} settings={settings}
          onOpen={openWorkout} onSettings={() => setSettingsOpen(true)} onTab={t => { setFocus(null); setTab(t) }}
        />
      )}
      {tab === 'calendar' && <CalendarScreen workouts={workouts} byDate={idx.byDate} exercises={byId} settings={settings} titles={idx.titles} onOpen={openWorkout} />}
      {tab === 'workout' && (current
        ? <WorkoutView key={current.id} workout={current} workouts={workouts} exercises={byId} settings={settings} titles={idx.titles} onBack={back} />
        : <NoWorkout workouts={workouts} settings={settings} titles={idx.titles} today={idx.today} onOpen={id => setFocus({ id, from: 'workout' })} />)}
      {tab === 'analytics' && <AnalyticsScreen workouts={workouts} exercises={byId} settings={settings} />}

      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-label={t.label} aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => { setFocus(null); setTab(t.id) }}>
            <Icon name={t.icon} size={20} stroke={2} />
            {tab === t.id && t.label}
            {t.id === 'workout' && idx.active && tab !== 'workout' && <span className="dot" />}
          </button>
        ))}
      </nav>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} body={body} list={list} workouts={workouts} />
    </div>
  )
}
