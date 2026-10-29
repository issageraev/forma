import { useMemo } from 'react'
import { Badge, Barcode, Icon, useToast } from '../ui'
import type { BodyEntry, Exercise, Workout } from '../domain/types'
import type { Settings } from '../db/db'
import { createWorkout, startWorkout } from '../db/repo'
import { exportBackup } from '../db/backup'
import { loadDemo } from '../db/demo'
import { dkey, fmtDuration, fmtLong, fmtRelative, fmtShort, shiftKey } from '../domain/dates'
import { doneSetsCount, tonnage } from '../domain/workout'
import { fmt } from '../domain/numbers'
import { normalize } from '../domain/exercises'
import { useKeyLifts } from './useKeyLifts'

export function HomeScreen({ workouts, active, upcoming, lastDone, body, exercises, settings, theme, onToggleTheme, onOpen, onSettings, onTab }: {
  workouts: Workout[]
  active?: Workout
  upcoming?: Workout
  lastDone?: Workout
  body: BodyEntry[]
  exercises: Map<string, Exercise>
  settings: Settings
  theme: 'light' | 'dark'
  onToggleTheme: (origin: { x: number; y: number }) => void
  onOpen: (id: string) => void
  onSettings: () => void
  onTab: (t: 'workout' | 'analytics') => void
}) {
  const toast = useToast()
  const today = dkey()
  const lifts = useKeyLifts(workouts, exercises, settings.keyLifts, shiftKey(today, -28))
  const weight = body.at(-1)
  const weekAgo = useMemo(() => [...body].reverse().find(b => b.date <= shiftKey(weight?.date ?? today, -6)), [body, weight, today])
  const bmi = weight && settings.height ? weight.kg / (settings.height / 100) ** 2 : null
  const daysSinceBackup = settings.lastBackupAt ? Math.floor((Date.now() - settings.lastBackupAt) / 864e5) : null
  const needBackup = workouts.some(w => w.status === 'done') && (daysSinceBackup == null || daysSinceBackup >= 7)

  // Подсказка по программе: ближайший день с программой без своей тренировки
  const programNext = useMemo(() => {
    for (let i = 0; i < 7; i++) {
      const k = shiftKey(today, i)
      const t = settings.program[new Date(k + 'T12:00').getDay()]
      if (t && !workouts.some(w => w.date === k)) return { date: k, title: t }
    }
    return undefined
  }, [settings.program, workouts, today])

  const startFromProgram = async (date: string, title: string) => {
    const t = normalize(title)
    const tpl = [...workouts].reverse().find(w => normalize(w.title) === t && w.exercises.length)
    const w = await createWorkout(date, title, { templateId: tpl?.id, time: '19:00' })
    if (date === today) await startWorkout(w.id)
    if (date === today) onOpen(w.id)
    else toast({ text: `«${title}» запланирована на ${fmtRelative(date).toLowerCase()}` })
  }

  const next = active ?? upcoming

  return (
    <div className="page">
      <div className="header">
        <div><p className="eyebrow">{fmtLong(today)}</p><h1 className="title">Моя форма</h1></div>
        <button className="icon-btn theme-btn" aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onToggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) }}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
        </button>
        <button className="icon-btn" onClick={onSettings} aria-label="Настройки"><Icon name="gear" size={20} /></button>
      </div>

      {needBackup && (
        <div className="banner">
          <Icon name="shield" size={20} />
          <span className="grow">{daysSinceBackup == null ? 'Копия данных ещё не сохранялась' : `Копии данных ${daysSinceBackup} дн.`}</span>
          <button className="pill sm" onClick={async () => { if (await exportBackup()) toast({ text: 'Копия сохранена' }) }}>Сохранить</button>
        </div>
      )}

      {!workouts.length && (
        <section className="card empty">
          <h3 className="card-title">Начнём?</h3>
          <p className="muted">Запишите первую тренировку — подходы сохраняются сразу, даже без интернета.</p>
          <button className="pill dark lg block" onClick={() => onTab('workout')}><Icon name="play" size={15} />Начать тренировку</button>
          <button className="link" onClick={() => loadDemo()}>Посмотреть на демо-данных</button>
        </section>
      )}

      {next ? (
        <section className="card">
          <div className="card-head">
            {next.status === 'active' ? <span className="live"><i />Идёт тренировка</span> : <Badge status="planned">{fmtRelative(next.date, today)}{next.time ? ` · ${next.time}` : ''}</Badge>}
          </div>
          <div className="stack">
          <h3 className="card-title">{next.title || 'Без названия'}</h3>
          <p className="muted">
            {next.exercises.length ? `${next.exercises.length} упражнения · ${doneSetsCount(next)} из ${next.exercises.reduce((a, e) => a + e.sets.length, 0)} подходов` : 'Упражнения добавите по ходу'}
          </p>
          </div>
          {next.exercises.length > 0 && (
            <div className="chips">
              {next.exercises.slice(0, 4).map(e => <span key={e.id} className="chip">{exercises.get(e.exerciseId)?.name}</span>)}
            </div>
          )}
          <button className="pill dark lg block" onClick={async () => { if (next.status === 'planned' && next.date === today) await startWorkout(next.id); onOpen(next.id) }}>
            <Icon name="play" size={15} />{next.status === 'active' ? 'Продолжить' : next.date === today ? 'Начать тренировку' : 'Открыть'}
          </button>
        </section>
      ) : programNext && (
        <section className="card">
          <div className="card-head"><h2>По программе</h2><Badge status="planned">{fmtRelative(programNext.date, today)}</Badge></div>
          <h3 className="card-title">{programNext.title}</h3>
          <button className="pill dark lg block" onClick={() => startFromProgram(programNext.date, programNext.title)}>
            <Icon name="play" size={15} />{programNext.date === today ? 'Начать' : 'Запланировать'}
          </button>
        </section>
      )}

      {lastDone && (
        <section className="card">
          <div className="card-head"><h2>Последняя тренировка</h2><Badge status="done" /></div>
          <div className="stack">
            <h3 className="card-sub">{lastDone.title || 'Без названия'}</h3>
            <p className="muted">{fmtShort(lastDone.date)} · {lastDone.exercises.length} упражнения · {doneSetsCount(lastDone)} подходов</p>
          </div>
          <div className="tiles">
            <div className="tile"><Icon name="bolt" size={15} stroke={2.2} /><b>{fmt(tonnage(lastDone) / 1000, 2)} т</b><span>тоннаж</span></div>
            <div className="tile"><Icon name="clock" size={15} stroke={2.2} /><b>{lastDone.startedAt && lastDone.finishedAt ? fmtDuration(lastDone.finishedAt - lastDone.startedAt) : '—'}</b><span>время</span></div>
            <div className="tile"><Icon name="scale" size={15} stroke={2.2} /><b>{lastDone.bodyWeight ? fmt(lastDone.bodyWeight) : '—'}</b><span>вес, кг</span></div>
          </div>
          <button className="pill ghost block" onClick={() => onOpen(lastDone.id)}>Открыть <Icon name="right" size={15} /></button>
        </section>
      )}

      {workouts.length > 0 && (
        <div className="two">
          <section className="card metric">
            <div className="card-head"><h2>Вес тела</h2><Icon name="scale" size={16} /></div>
            {weight ? (
              <>
                <span className="big-num">{fmt(weight.kg)}<small>кг</small></span>
                {weekAgo && <span className={`delta ${weight.kg <= weekAgo.kg ? 'good' : 'bad'}`}>{weight.kg - weekAgo.kg > 0 ? '▲ +' : weight.kg < weekAgo.kg ? '▼ ' : ''}{fmt(Math.abs(weight.kg - weekAgo.kg))} кг за неделю</span>}
                <Barcode values={body.slice(-12).map(b => b.kg)} />
                {bmi && <span className="muted small">Рост {settings.height} см · ИМТ {fmt(bmi)}</span>}
              </>
            ) : (
              <button className="link" style={{ textAlign: 'left' }} onClick={onSettings}>Указать вес и рост</button>
            )}
          </section>
          <section className="card metric tap" onClick={() => onTab('analytics')}>
            <div className="card-head"><h2>Сила</h2><Icon name="trend" size={16} /></div>
            <span className="big-num">{lifts.index == null ? '—' : `${lifts.index >= 0 ? '+' : ''}${fmt(lifts.index)}`}<small>%</small></span>
            <span className="muted small">за 4 недели по основным</span>
            <div className="list" style={{ marginTop: 6 }}>
              {lifts.rows.slice(0, 3).map(l => (
                <div key={l.id} style={{ padding: '8px 0', fontSize: 13 }}>
                  <span className="grow">{l.short}</span>
                  <b className={l.change != null && l.change > 0 ? 'good' : ''}>{l.level ? fmt(l.level, 0) : '—'}</b>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
