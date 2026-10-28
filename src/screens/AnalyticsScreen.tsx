import { useMemo, useState } from 'react'
import { Icon, Segmented, Sheet, Sparkline } from '../ui'
import type { Exercise, Workout } from '../domain/types'
import { setSetting, type Settings } from '../db/db'
import { addDays, dkey, fmtShort, shiftKey, startOfWeek } from '../domain/dates'
import { fmt } from '../domain/numbers'
import { dayStatus, tonnage } from '../domain/workout'
import { useKeyLifts } from './useKeyLifts'

type Period = '28' | '90' | '365'
const PERIODS: { value: Period; label: string }[] = [{ value: '28', label: 'Месяц' }, { value: '90', label: '3 месяца' }, { value: '365', label: 'Год' }]

export function AnalyticsScreen({ workouts, exercises, settings }: { workouts: Workout[]; exercises: Map<string, Exercise>; settings: Settings }) {
  const [period, setPeriod] = useState<Period>('28')
  const [editLifts, setEditLifts] = useState(false)
  const today = dkey()
  const since = shiftKey(today, -Number(period))
  const lifts = useKeyLifts(workouts, exercises, settings.keyLifts, since)

  const inPeriod = workouts.filter(w => w.date > since && w.date <= today)
  const done = inPeriod.filter(w => w.status === 'done')
  const missed = inPeriod.filter(w => dayStatus(w) === 'missed').length
  const ton = done.reduce((a, w) => a + tonnage(w), 0)
  const durations = done.filter(w => w.startedAt && w.finishedAt).map(w => w.finishedAt! - w.startedAt!)
  const avgMin = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000) : null

  const weeks = useMemo(() => {
    const start = startOfWeek(new Date())
    return Array.from({ length: 8 }, (_, i) => {
      const from = dkey(addDays(start, (i - 7) * 7)), to = dkey(addDays(start, (i - 6) * 7))
      return { label: fmtShort(from).split(', ')[1], count: workouts.filter(w => w.status === 'done' && w.date >= from && w.date < to).length }
    })
  }, [workouts])
  const maxWeek = Math.max(4, ...weeks.map(w => w.count))

  const withHistory = useMemo(() => {
    const used = new Set(workouts.flatMap(w => w.exercises.map(e => e.exerciseId)))
    return [...exercises.values()].filter(e => !e.archived && e.kind !== 'time' && (used.has(e.id) || settings.keyLifts.includes(e.id)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [workouts, exercises, settings.keyLifts])

  return (
    <div className="page">
      <div className="header"><div><p className="eyebrow">Статистика</p><h1 className="title">Аналитика</h1></div></div>
      <Segmented value={period} options={PERIODS} onChange={setPeriod} />

      <section className="card">
        <div className="card-head"><h2>Тренировки</h2><span className="muted small">последние 8 недель</span></div>
        <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
          <div>
            <span className="big-num">{done.length}</span>
            <div className={`delta ${missed ? 'bad' : 'good'}`}>{missed ? `${missed} пропущено` : 'без пропусков'}</div>
          </div>
          <div className="weeks grow">
            {weeks.map((w, i) => (
              <div key={i}>
                <b>{w.count || ''}</b>
                <span className={`bar ${w.count ? '' : 'zero'}`} style={{ height: `${Math.max(4, (w.count / maxWeek) * 70)}%`, opacity: i === 7 ? 0.55 : 1 }} />
                <small>{w.label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="tiles">
          <div className="tile"><b>{fmt(ton / 1000, 1)} т</b><span>тоннаж</span></div>
          <div className="tile"><b>{avgMin != null ? `${Math.floor(avgMin / 60)}:${String(avgMin % 60).padStart(2, '0')}` : '—'}</b><span>ср. время</span></div>
          <div className="tile"><b>{done.length ? fmt(done.reduce((a, w) => a + w.exercises.length, 0) / done.length) : '—'}</b><span>упр. за раз</span></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Сила · основные упражнения</h2>
          <button className="link" onClick={() => setEditLifts(true)}>Изменить</button>
        </div>
        <div className="row" style={{ alignItems: 'baseline' }}>
          <span className="big-num">{lifts.index == null ? '—' : `${lifts.index >= 0 ? '+' : ''}${fmt(lifts.index)}`}<small>%</small></span>
          <span className="muted small grow">силовой индекс за {PERIODS.find(p => p.value === period)!.label.toLowerCase()}</span>
        </div>
        <div>
          {lifts.rows.map(l => (
            <div key={l.id} className="lift-row">
              <div className="grow">
                <b style={{ fontSize: 14.5 }}>{l.name}</b>
                <div className="muted small">{l.series.length ? `лучший: ${fmt(l.series.at(-1)!.topWeight)} × ${l.series.at(-1)!.topReps}` : 'нет данных'}</div>
              </div>
              <Sparkline values={l.series.slice(-10).map(p => p.e1rm)} />
              <div className="val">
                <b>{l.level ? fmt(l.level, 0) : '—'}</b><span className="muted small"> кг</span>
                <small className={l.change == null ? 'muted' : l.change >= 0 ? 'good' : 'bad'}>{l.change == null ? '1ПМ' : `${l.change >= 0 ? '▲ +' : '▼ '}${fmt(Math.abs(l.change))}%`}</small>
              </div>
            </div>
          ))}
        </div>
        <p className="note">1ПМ — расчётный максимум на 1 повтор (формула Эпли) по рабочим подходам. Уровень — медиана последних трёх тренировок, поэтому один неудачный день график не обрушит. Разминка (легче 60% от лучшего подхода) не учитывается.</p>
      </section>

      <section className="card">
        <div className="row"><Icon name="layers" size={18} /><b className="grow">Вода, питание и ИИ-оценка</b><span className="badge badge-empty">MVP 2–3</span></div>
        <p className="note">Появятся в следующих версиях: учёт воды и еды по трём уровням «тяжести», общая оценка месяца.</p>
      </section>

      <Sheet open={editLifts} onClose={() => setEditLifts(false)} title="Основные упражнения">
        <p className="note">По ним считается силовой индекс. Лучше 3–5 базовых.</p>
        <div className="check-list">
          {withHistory.map(e => (
            <label key={e.id}>
              <input type="checkbox" checked={settings.keyLifts.includes(e.id)} onChange={ev => setSetting('keyLifts', ev.target.checked ? [...settings.keyLifts, e.id] : settings.keyLifts.filter(x => x !== e.id))} />
              <span className="grow">{e.name}</span><span className="muted small">{e.category}</span>
            </label>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
