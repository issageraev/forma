import { useMemo, useState } from 'react'
import { Badge, Icon, Sheet, confirmAsk, useToast } from '../ui'
import type { Exercise, Workout } from '../domain/types'
import type { Settings } from '../db/db'
import { setSetting } from '../db/db'
import { createWorkout, deleteWorkout, restoreWorkout, startWorkout } from '../db/repo'
import { DOW, DOW_SHORT, MONTHS_NOM, WEEK_ORDER, dkey, fmtDuration, fmtLong, fmtRelative, monthGrid, parseKey } from '../domain/dates'
import { dayStatus, doneSetsCount, tonnage } from '../domain/workout'
import { normalize, titleColor } from '../domain/exercises'
import { fmt } from '../domain/numbers'

const TIMES = ['07:00', '12:00', '18:00', '19:00', '20:00']

function PlanForm({ date, workouts, settings, titles, initialTitle = '', templateId, onDone }: {
  date: string
  workouts: Workout[]
  settings: Settings
  titles: string[]
  initialTitle?: string
  templateId?: string
  onDone: (id: string, open: boolean) => void
}) {
  const today = dkey()
  const programTitle = settings.program[parseKey(date).getDay()]
  const [title, setTitle] = useState(initialTitle || programTitle || '')
  const [time, setTime] = useState<string | undefined>(date >= today ? '19:00' : undefined)
  const [useTpl, setUseTpl] = useState(true)
  const options = [...new Set([programTitle, ...titles].filter((t): t is string => !!t))].slice(0, 8)
  const tpl = useMemo(() => {
    if (templateId) return workouts.find(w => w.id === templateId)
    const t = normalize(title)
    return t ? [...workouts].reverse().find(w => w.date < date && normalize(w.title) === t && w.exercises.length) : undefined
  }, [workouts, title, date, templateId])

  const submit = async (start: boolean) => {
    const w = await createWorkout(date, title, { templateId: useTpl ? tpl?.id : undefined, time })
    if (start) await startWorkout(w.id)
    onDone(w.id, start || date <= today)
  }

  return (
    <>
      <label className="field">
        <span>Название дня</span>
        <input className="text-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Спина / Плечи" enterKeyHint="done" />
      </label>
      {options.length > 0 && <div className="chips">{options.map(t => <button key={t} className={`chip ${normalize(t) === normalize(title) ? 'on' : ''}`} onClick={() => setTitle(t)}>{t}</button>)}</div>}
      {date >= today && (
        <div className="row">
          <span className="muted" style={{ width: 52 }}>Время</span>
          <div className="chips" style={{ margin: 0, padding: 0 }}>
            <button className={`chip ${!time ? 'on' : ''}`} onClick={() => setTime(undefined)}>—</button>
            {TIMES.map(t => <button key={t} className={`chip ${time === t ? 'on' : ''}`} onClick={() => setTime(t)}>{t}</button>)}
          </div>
        </div>
      )}
      {tpl && (
        <label className="banner" style={{ background: 'rgba(248,231,216,.75)', color: 'var(--ink)' }}>
          <input type="checkbox" checked={useTpl} onChange={e => setUseTpl(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--orange)' }} />
          <span className="grow"><b>Взять упражнения из «{tpl.title}»</b><br /><span className="muted small">{fmtRelative(tpl.date)} · {tpl.exercises.length} упражнения с прошлыми весами</span></span>
        </label>
      )}
      {date === today ? (
        <div className="row">
          <button className="pill ghost block lg" onClick={() => submit(false)}>Запланировать</button>
          <button className="pill dark block lg" onClick={() => submit(true)}><Icon name="play" size={15} />Начать</button>
        </div>
      ) : (
        <button className="pill dark block lg" onClick={() => submit(false)}>{date < today ? 'Внести прошедшую тренировку' : 'Запланировать'}</button>
      )}
    </>
  )
}

function DaySheet({ date, workout, workouts, exercises, settings, titles, onClose, onOpen }: {
  date: string
  workout?: Workout
  workouts: Workout[]
  exercises: Map<string, Exercise>
  settings: Settings
  titles: string[]
  onClose: () => void
  onOpen: (id: string) => void
}) {
  const toast = useToast()
  const [repeat, setRepeat] = useState(false)
  const today = dkey()
  const status = dayStatus(workout)

  const remove = async () => {
    if (!workout || !confirmAsk('Удалить тренировку?')) return
    const snapshot = structuredClone(workout)
    await deleteWorkout(workout.id)
    onClose()
    toast({ text: 'Тренировка удалена', action: { label: 'Отменить', run: () => restoreWorkout(snapshot) } })
  }

  if (!workout || repeat) {
    const target = repeat ? (workouts.some(w => w.date === today) ? dkey(new Date(Date.now() + 864e5)) : today) : date
    return (
      <Sheet open onClose={onClose} title={repeat ? `Повторить · ${fmtRelative(target)}` : fmtLong(date)}>
        {!repeat && <p className="muted">{date < today ? 'Тренировки не было. Можно внести её задним числом.' : 'Свободный день'}</p>}
        <PlanForm
          date={target}
          workouts={workouts}
          settings={settings}
          titles={titles}
          initialTitle={repeat ? workout?.title : undefined}
          templateId={repeat ? workout?.id : undefined}
          onDone={(id, open) => { onClose(); if (open) onOpen(id); else toast({ text: 'Тренировка запланирована' }) }}
        />
      </Sheet>
    )
  }

  const duration = workout.startedAt && workout.finishedAt ? fmtDuration(workout.finishedAt - workout.startedAt) : '—'
  return (
    <Sheet open onClose={onClose} title={<span className="muted" style={{ fontSize: 14 }}>{fmtLong(date)}{workout.time ? ` · ${workout.time}` : ''}</span>}>
      <div className="row">
        <h3 className="card-title grow">{workout.title || 'Без названия'}</h3>
        {status !== 'empty' && <Badge status={status} />}
      </div>
      {workout.status === 'done' && (
        <div className="tiles">
          <div className="tile"><Icon name="clock" size={15} stroke={2.2} /><b>{duration}</b><span>время</span></div>
          <div className="tile"><Icon name="layers" size={15} stroke={2.2} /><b>{doneSetsCount(workout)}</b><span>подходов</span></div>
          <div className="tile"><Icon name="bolt" size={15} stroke={2.2} /><b>{fmt(tonnage(workout) / 1000, 2)} т</b><span>тоннаж</span></div>
        </div>
      )}
      {workout.exercises.length > 0 ? (
        <div className="card" style={{ padding: '4px 14px' }}>
          <div className="list">
            {workout.exercises.map(e => {
              const done = e.sets.filter(s => s.done)
              const top = (done.length ? done : e.sets).reduce((a, s) => ((s.w ?? 0) > (a.w ?? 0) ? s : a), e.sets[0])
              return (
                <div key={e.id}>
                  <span className="grow">{exercises.get(e.exerciseId)?.name ?? 'Упражнение'}</span>
                  {top && <b>{top.w ? `${fmt(top.w)} кг × ` : ''}{top.r ?? '—'}</b>}
                  <em>{done.length || e.sets.length} подх.</em>
                </div>
              )
            })}
          </div>
        </div>
      ) : <p className="muted">Упражнения ещё не добавлены</p>}
      <div className="row">
        {workout.status === 'done'
          ? <button className="pill ghost block lg" onClick={() => setRepeat(true)}><Icon name="repeat" size={16} />Повторить</button>
          : <button className="icon-btn" onClick={remove} aria-label="Удалить"><Icon name="trash" size={17} /></button>}
        <button className="pill dark block lg" onClick={() => { onClose(); onOpen(workout.id) }}>{workout.status === 'done' ? 'Открыть' : status === 'missed' ? 'Внести' : workout.date === today ? 'Перейти' : 'Открыть'}</button>
      </div>
    </Sheet>
  )
}

function ProgramSheet({ open, onClose, settings, titles }: { open: boolean; onClose: () => void; settings: Settings; titles: string[] }) {
  const [draft, setDraft] = useState(settings.program)
  const [focus, setFocus] = useState<number | null>(null)
  return (
    <Sheet open={open} onClose={onClose} title="Программа недели">
      <p className="note">Подсказки в календаре и на Главной. Разовые тренировки остаются главными: программа ничего не создаёт сама.</p>
      <div>
        {WEEK_ORDER.map(d => (
          <div key={d} className="program-row">
            <b>{DOW_SHORT[d]}</b>
            <input
              className="text-input" aria-label={DOW[d]} value={draft[d] ?? ''} placeholder="Отдых"
              onFocus={() => setFocus(d)} onChange={e => setDraft(p => ({ ...p, [d]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {focus != null && titles.length > 0 && (
        <div className="chips">{titles.slice(0, 10).map(t => <button key={t} className="chip" onMouseDown={e => e.preventDefault()} onClick={() => setDraft(p => ({ ...p, [focus]: t }))}>{t}</button>)}</div>
      )}
      <button className="pill dark block lg" onClick={async () => {
        const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()]))
        await setSetting('program', clean)
        onClose()
      }}>Сохранить</button>
    </Sheet>
  )
}

export function CalendarScreen({ workouts, byDate, exercises, settings, titles, onOpen }: {
  workouts: Workout[]
  byDate: Map<string, Workout>
  exercises: Map<string, Exercise>
  settings: Settings
  titles: string[]
  onOpen: (id: string) => void
}) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [day, setDay] = useState<string | null>(null)
  const [program, setProgram] = useState(false)
  const today = dkey()
  const grid = useMemo(() => monthGrid(ym.y, ym.m), [ym])
  const shift = (n: number) => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  const prefix = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
  const inMonth = workouts.filter(w => w.date.startsWith(prefix))
  const doneCount = inMonth.filter(w => w.status === 'done').length
  const missed = inMonth.filter(w => dayStatus(w) === 'missed').length
  const planned = inMonth.filter(w => w.status === 'planned' && w.date >= today).length
  const upcoming = workouts.filter(w => w.status === 'planned' && w.date >= today).slice(0, 3)
  const hasProgram = Object.keys(settings.program).length > 0

  return (
    <div className="page">
      <div className="header">
        <div><p className="eyebrow">Календарь · {ym.y}</p><h1 className="title">{MONTHS_NOM[ym.m]}</h1></div>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Предыдущий месяц"><Icon name="left" /></button>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Следующий месяц"><Icon name="right" /></button>
      </div>
      <div className="row">
        <button className="pill ghost sm" onClick={() => setProgram(true)}><Icon name="list" size={15} />{hasProgram ? 'Программа недели' : 'Задать программу'}</button>
        {(ym.y !== now.getFullYear() || ym.m !== now.getMonth()) && <button className="pill ghost sm" onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}>Сегодня</button>}
      </div>

      <div className="tiles">
        <div className="tile"><b>{doneCount}</b><span>тренировок</span></div>
        <div className="tile"><b>{planned}</b><span>впереди</span></div>
        <div className="tile"><b className={missed ? 'bad' : ''}>{missed}</b><span>пропущено</span></div>
      </div>

      <section className="card cal">
        <div className="cal-head">{WEEK_ORDER.map(d => <span key={d}>{DOW_SHORT[d]}</span>)}</div>
        {grid.map((week, i) => (
          <div key={i} className="cal-row">
            {week.map(c => {
              const w = byDate.get(c.key)
              const st = dayStatus(w)
              const suggestion = !w && c.key >= today ? settings.program[parseKey(c.key).getDay()] : undefined
              const color = titleColor(w?.title ?? suggestion ?? '')
              const cls = ['cell', !c.inMonth && 'out', w && 'has', st !== 'empty' && st, (w || suggestion) && `c-${color}`, suggestion && 'suggest', c.key === today && 'today'].filter(Boolean).join(' ')
              return (
                <button key={c.key} className={cls} onClick={() => setDay(c.key)} aria-label={`${fmtLong(c.key)}${w ? `, ${w.title}` : ''}`}>
                  {c.day}<i />
                </button>
              )
            })}
          </div>
        ))}
        <div className="legend">
          <span><i style={{ background: 'var(--orange)' }} />Грудь</span>
          <span><i style={{ background: 'var(--violet)' }} />Спина</span>
          <span><i style={{ background: 'var(--green)' }} />Ноги</span>
          <span><i style={{ background: 'var(--amber)' }} />Плечи</span>
          <span><i style={{ background: 'var(--pink)' }} />Руки</span>
          <span><i className="box" />план</span>
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Ближайшие</h2></div>
          <div className="list">
            {upcoming.map(w => (
              <button key={w.id} onClick={() => setDay(w.date)} style={{ textAlign: 'left' }}>
                <span className="day-num">{parseKey(w.date).getDate()}</span>
                <span className="grow"><b>{w.title || 'Без названия'}</b><br /><em>{fmtRelative(w.date, today)}{w.time ? ` · ${w.time}` : ''}{w.exercises.length ? ` · ${w.exercises.length} упр.` : ''}</em></span>
                <Badge status="planned">{fmtRelative(w.date, today)}</Badge>
              </button>
            ))}
          </div>
        </section>
      )}

      {day && (
        <DaySheet date={day} workout={byDate.get(day)} workouts={workouts} exercises={exercises} settings={settings} titles={titles}
          onClose={() => setDay(null)} onOpen={onOpen} />
      )}
      {program && <ProgramSheet open onClose={() => setProgram(false)} settings={settings} titles={titles} />}
    </div>
  )
}
