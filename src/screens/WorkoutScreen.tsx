import { createRef, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Badge, Icon, NumberField, confirmAsk, useToast } from '../ui'
import { ExercisePicker } from '../components/ExercisePicker'
import type { Exercise, SetEntry, Workout, WorkoutExercise } from '../domain/types'
import type { Settings } from '../db/db'
import { dayStatus, doneSetsCount, isExerciseDone, tonnage, totalSetsCount } from '../domain/workout'
import { fmtDuration, fmtLong, fmtRelative, fmtShort } from '../domain/dates'
import { fmt, roundTo } from '../domain/numbers'
import { sessionE1rm } from '../domain/strength'
import { normalize } from '../domain/exercises'
import {
  addExerciseToWorkout, createWorkout, deleteWorkout, finishWorkout, newSet, reopenWorkout, restoreWorkout,
  startWorkout, toggleSet, updateWorkout,
} from '../db/repo'

export function useNow(ms: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

/** Последнее выполнение упражнения до даты — из уже загруженного списка, без запроса к базе */
function previousOf(workouts: Workout[], exerciseId: string, beforeDate: string) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i]
    if (w.date >= beforeDate) continue
    const e = w.exercises.find(x => x.exerciseId === exerciseId && x.sets.some(s => s.done))
    if (e) return { date: w.date, sets: e.sets.filter(s => s.done), bodyWeight: w.bodyWeight }
  }
  return undefined
}

const bestSet = (sets: SetEntry[]) => sets.reduce<SetEntry | undefined>((a, s) => (!a || (s.w ?? 0) > (a.w ?? 0) ? s : a), undefined)
const setText = (s: SetEntry | undefined, kind: Exercise['kind']) => {
  if (!s) return '—'
  if (kind === 'time') return `${s.r ?? 0} с${s.w ? ` · +${fmt(s.w)} кг` : ''}`
  if (kind === 'bodyweight') return `${s.w ? `+${fmt(s.w)} кг` : 'свой вес'} × ${s.r ?? 0}`
  return `${fmt(s.w ?? 0)} кг × ${s.r ?? 0}`
}

function ExerciseBlock({ we, index, exercise, workout, workouts, expanded, isCurrent, onToggle }: {
  we: WorkoutExercise
  index: number
  exercise: Exercise | undefined
  workout: Workout
  workouts: Workout[]
  expanded: boolean
  isCurrent: boolean
  onToggle: () => void
}) {
  const toast = useToast()
  const kind = exercise?.kind ?? 'weight'
  const prev = useMemo(() => previousOf(workouts, we.exerciseId, workout.date), [workouts, we.exerciseId, workout.date])
  const complete = isExerciseDone(we)
  const doneSets = we.sets.filter(s => s.done)
  const refs = useRef<RefObject<HTMLInputElement>[]>([])
  refs.current = we.sets.flatMap((_, i) => [refs.current[i * 2] ?? createRef(), refs.current[i * 2 + 1] ?? createRef()])
  const firstOpen = we.sets.findIndex(s => !s.done)

  const patchSet = (setId: string, fn: (s: SetEntry) => void) =>
    updateWorkout(workout.id, w => { const s = w.exercises.find(e => e.id === we.id)?.sets.find(x => x.id === setId); if (s) fn(s) })

  const check = async (s: SetEntry, i: number) => {
    // Пустые поля при отметке заполняем прошлым результатом — чаще всего нужно просто нажать ✓
    if (!s.done && (s.w == null || s.r == null)) {
      const p = prev?.sets[i] ?? prev?.sets[prev.sets.length - 1] ?? we.sets[i - 1]
      if (p) await patchSet(s.id, x => { x.w ??= p.w; x.r ??= p.r })
    }
    await toggleSet(workout.id, we.id, s.id)
  }

  const removeExercise = async () => {
    const snapshot = structuredClone(workout)
    await updateWorkout(workout.id, w => { w.exercises = w.exercises.filter(e => e.id !== we.id) })
    toast({ text: `«${exercise?.name ?? 'Упражнение'}» удалено`, action: { label: 'Отменить', run: () => restoreWorkout(snapshot) } })
  }

  if (!expanded) {
    return (
      <section className={`card ex-card slim ${complete ? 'complete' : ''}`}>
        <button className="collapsed" onClick={onToggle}>
          <span className={`ex-num ${complete ? 'ok' : 'idle'}`}>{complete ? <Icon name="check" size={15} stroke={2.6} /> : index + 1}</span>
          <div>
            <b>{exercise?.name ?? 'Упражнение'}</b>
            <span>{doneSets.length ? `${doneSets.length} × ${setText(bestSet(doneSets), kind)}` : `${we.sets.length} подх. · ${prev ? `прошлый раз ${setText(bestSet(prev.sets), kind)}` : 'новое'}`}</span>
          </div>
          <Icon name="right" size={16} />
        </button>
      </section>
    )
  }

  const p1 = prev ? sessionE1rm(prev.sets, kind, prev.bodyWeight) : null
  const open = firstOpen >= 0 ? we.sets[firstOpen] : undefined

  return (
    <section className={`card ex-card ${isCurrent ? 'current' : ''} ${complete ? 'complete' : ''}`}>
      <div className="ex-head">
        <button className="row grow" style={{ textAlign: 'left', gap: 12 }} onClick={onToggle}>
          <span className={`ex-num ${complete ? 'ok' : ''}`}>{complete ? <Icon name="check" size={15} stroke={2.6} /> : index + 1}</span>
          <div className="grow">
            <h3>{exercise?.name ?? 'Упражнение'}</h3>
            <small>{exercise?.category}{kind === 'bodyweight' ? ' · свой вес' : kind === 'time' ? ' · на время' : ''}</small>
          </div>
        </button>
        <button className="icon-btn ghost sm" onClick={removeExercise} aria-label="Удалить упражнение"><Icon name="trash" size={16} /></button>
      </div>

      {prev && (
        <div className="hint">
          <span className="grow">Прошлый раз · {fmtShort(prev.date)}: <b>{setText(bestSet(prev.sets), kind)}</b>, {prev.sets.length} подх.</span>
          {p1 != null && <span className="small">1ПМ ≈ <b>{fmt(p1, 0)}</b></span>}
        </div>
      )}

      <div className="sets">
        <div className="set-row set-head">
          <span>Подход</span>
          <span>{kind === 'bodyweight' ? '+ Вес, кг' : 'Вес, кг'}</span>
          <span>{kind === 'time' ? 'Секунды' : 'Повторы'}</span>
          <span />
        </div>
        {we.sets.map((s, i) => {
          const ph = prev?.sets[i] ?? prev?.sets[prev.sets.length - 1]
          return (
            <div key={s.id} className={`set-row ${s.done ? 'done' : ''}`}>
              <button
                className="set-no"
                aria-label={`Подход ${i + 1}. Удалить`}
                onClick={() => {
                  if (we.sets.length <= 1) return
                  if (s.done && !confirmAsk(`Удалить выполненный подход ${i + 1}?`)) return
                  updateWorkout(workout.id, w => { const e = w.exercises.find(x => x.id === we.id); if (e) e.sets = e.sets.filter(x => x.id !== s.id) })
                }}
              >{i + 1}</button>
              <NumberField
                ariaLabel={`Вес, подход ${i + 1}`}
                value={s.w}
                placeholder={ph?.w != null ? fmt(ph.w) : kind === 'weight' ? '0' : '—'}
                inputRef={refs.current[i * 2]}
                onEnter={() => refs.current[i * 2 + 1]?.current?.focus()}
                onCommit={n => patchSet(s.id, x => { x.w = n })}
              />
              <NumberField
                integer
                ariaLabel={`Повторы, подход ${i + 1}`}
                value={s.r}
                placeholder={ph?.r != null ? String(ph.r) : '0'}
                inputRef={refs.current[i * 2 + 1]}
                enterKeyHint={i === we.sets.length - 1 ? 'done' : 'next'}
                onEnter={() => { const nx = refs.current[(i + 1) * 2]; nx?.current ? nx.current.focus() : refs.current[i * 2 + 1]?.current?.blur() }}
                onCommit={n => patchSet(s.id, x => { x.r = n })}
              />
              <button className={`check ${s.done ? 'on' : ''}`} onClick={() => check(s, i)} aria-label={s.done ? 'Снять отметку' : 'Подход выполнен'} aria-pressed={s.done}>
                <Icon name="check" size={18} stroke={2.6} />
              </button>
            </div>
          )
        })}
      </div>

      {open && (
        <div className="steps" aria-label="Быстрая правка текущего подхода">
          <button className="step" onClick={() => patchSet(open.id, x => { x.w = Math.max(0, roundTo((x.w ?? prev?.sets[firstOpen]?.w ?? 0) - 2.5, 0.25)) })}>−2,5 кг</button>
          <button className="step" onClick={() => patchSet(open.id, x => { x.w = roundTo((x.w ?? prev?.sets[firstOpen]?.w ?? 0) + 2.5, 0.25) })}>+2,5 кг</button>
          <button className="step" onClick={() => patchSet(open.id, x => { x.r = Math.max(0, (x.r ?? prev?.sets[firstOpen]?.r ?? 0) - 1) })}>−1 {kind === 'time' ? 'с' : 'повт'}</button>
          <button className="step" onClick={() => patchSet(open.id, x => { x.r = (x.r ?? prev?.sets[firstOpen]?.r ?? 0) + 1 })}>+1 {kind === 'time' ? 'с' : 'повт'}</button>
        </div>
      )}

      <button className="pill ghost block" onClick={() => updateWorkout(workout.id, w => {
        const e = w.exercises.find(x => x.id === we.id); if (!e) return
        const last = e.sets[e.sets.length - 1]
        e.sets.push(newSet(last?.w ?? null, last?.r ?? null))
      })}><Icon name="plus" size={16} />Подход</button>
    </section>
  )
}

function TitleChips({ value, options, onPick }: { value: string; options: string[]; onPick: (t: string) => void }) {
  if (!options.length) return null
  return (
    <div className="chips">
      {options.map(t => <button key={t} className={`chip ${normalize(t) === normalize(value) ? 'on' : ''}`} onClick={() => onPick(t)}>{t}</button>)}
    </div>
  )
}

export function WorkoutView({ workout, workouts, exercises, settings, titles, onBack }: {
  workout: Workout
  workouts: Workout[]
  exercises: Map<string, Exercise>
  settings: Settings
  titles: string[]
  onBack?: () => void
}) {
  const toast = useToast()
  const now = useNow(30_000)
  const [picker, setPicker] = useState(false)
  const [manual, setManual] = useState<Record<string, boolean>>({})
  const status = dayStatus(workout)
  const list = useMemo(() => [...exercises.values()], [exercises])
  const currentIdx = workout.exercises.findIndex(e => !isExerciseDone(e))
  const isExpanded = (we: WorkoutExercise, i: number) => manual[we.id] ?? (workout.status === 'done' ? false : i === currentIdx)

  const programTitle = settings.program[new Date(workout.date + 'T12:00').getDay()]
  const titleOptions = [...new Set([programTitle, ...titles].filter((t): t is string => !!t))].slice(0, 8)
  const template = useMemo(() => {
    if (workout.exercises.length || !workout.title.trim()) return undefined
    const t = normalize(workout.title)
    return [...workouts].reverse().find(w => w.date < workout.date && normalize(w.title) === t && w.exercises.length)
  }, [workouts, workout])

  const remove = async () => {
    if (!confirmAsk('Удалить эту тренировку?')) return
    const snapshot = structuredClone(workout)
    await deleteWorkout(workout.id)
    onBack?.()
    toast({ text: 'Тренировка удалена', action: { label: 'Отменить', run: () => restoreWorkout(snapshot) } })
  }

  const elapsed = workout.startedAt ? (workout.finishedAt ?? (workout.status === 'active' ? now : workout.lastActivityAt ?? now)) - workout.startedAt : 0
  const done = doneSetsCount(workout), total = totalSetsCount(workout)

  return (
    <div className="page">
      <div className="row" style={{ minHeight: 44 }}>
        {onBack && <button className="icon-btn" onClick={onBack} aria-label="Назад"><Icon name="left" /></button>}
        <div className="grow">
          {workout.status === 'active'
            ? <span className="live"><i />Идёт · {fmtDuration(elapsed)}</span>
            : <Badge status={status === 'empty' ? 'planned' : status}>{status === 'done' && workout.startedAt ? `Завершена · ${fmtDuration(elapsed)}` : undefined}</Badge>}
          <div className="muted" style={{ marginTop: 4 }}>{fmtLong(workout.date)}{workout.time ? ` · ${workout.time}` : ''}</div>
        </div>
        {workout.status === 'active' && <button className="pill dark" onClick={async () => { await finishWorkout(workout.id); toast({ text: 'Тренировка завершена 💪' }) }}><Icon name="check" size={16} stroke={2.4} />Завершить</button>}
        {workout.status === 'planned' && <button className="pill dark" onClick={() => startWorkout(workout.id)}><Icon name="play" size={15} />Начать</button>}
        {workout.status === 'done' && <button className="pill ghost" onClick={() => reopenWorkout(workout.id)}><Icon name="edit" size={15} />Изменить</button>}
      </div>

      <input
        className="title-input"
        value={workout.title}
        placeholder="Название дня"
        aria-label="Название тренировки"
        enterKeyHint="done"
        onChange={e => updateWorkout(workout.id, w => { w.title = e.target.value })}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {workout.status !== 'done' && <TitleChips value={workout.title} options={titleOptions} onPick={t => updateWorkout(workout.id, w => { w.title = t })} />}
      {workout.autoFinished && <div className="banner info">Завершена автоматически — через час после последнего подхода.</div>}

      {template && (
        <button className="card template-card tap"
          onClick={() => updateWorkout(workout.id, w => {
            w.exercises = template.exercises.map(e => ({ id: crypto.randomUUID(), exerciseId: e.exerciseId, sets: e.sets.filter(s => s.done || s.w != null).map(s => newSet(s.w, s.r)) }))
          })}>
          <span className="icon-btn sm accent"><Icon name="copy" size={16} /></span>
          <div className="grow stack"><b>Повторить «{template.title}»</b><div className="muted small">{fmtShort(template.date)} · {template.exercises.length} упражнения с прошлыми весами</div></div>
          <Icon name="right" size={16} />
        </button>
      )}

      {workout.exercises.length > 0 && (
        <section className="card">
          <div className="card-head">
            <b style={{ fontSize: 14 }}>{workout.status === 'done' ? 'Итог' : `Упражнение ${Math.min(currentIdx < 0 ? workout.exercises.length : currentIdx + 1, workout.exercises.length)} из ${workout.exercises.length}`}</b>
            <span className="muted">{done} / {total} подходов</span>
          </div>
          <div className="segments">
            {workout.exercises.map((e, i) => <i key={e.id} className={isExerciseDone(e) ? 'done' : i === currentIdx && workout.status === 'active' ? 'cur' : ''} />)}
          </div>
          <div className="tiles">
            <div className="tile"><Icon name="bolt" size={15} stroke={2.2} /><b>{fmt(tonnage(workout) / 1000, 2)} т</b><span>тоннаж</span></div>
            <label className="tile" style={{ gap: 0 }}>
              <Icon name="scale" size={15} stroke={2.2} />
              <NumberField
                className="bw"
                ariaLabel="Личный вес"
                value={workout.bodyWeight}
                placeholder="—"
                enterKeyHint="done"
                onCommit={n => updateWorkout(workout.id, w => { w.bodyWeight = n })}
              />
              <span>личный вес, кг</span>
            </label>
            <div className="tile"><Icon name="clock" size={15} stroke={2.2} /><b>{workout.startedAt ? fmtDuration(elapsed) : '—'}</b><span>время</span></div>
          </div>
        </section>
      )}

      {workout.exercises.map((we, i) => (
        <ExerciseBlock
          key={we.id}
          we={we}
          index={i}
          exercise={exercises.get(we.exerciseId)}
          workout={workout}
          workouts={workouts}
          expanded={isExpanded(we, i)}
          isCurrent={i === currentIdx && workout.status !== 'done'}
          onToggle={() => setManual(m => ({ ...m, [we.id]: !isExpanded(we, i) }))}
        />
      ))}

      <button className="add-dashed" onClick={() => setPicker(true)}><Icon name="plus" size={20} />Добавить упражнение</button>
      <button className="link danger" style={{ alignSelf: 'center', marginTop: 6 }} onClick={remove}>Удалить тренировку</button>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} list={list} onPick={async e => { setPicker(false); await addExerciseToWorkout(workout.id, e.id) }} />
    </div>
  )
}

/** Экран, когда тренировки на сегодня нет: программа, свободный старт, ближайшие */
export function NoWorkout({ workouts, settings, titles, today, onOpen }: {
  workouts: Workout[]
  settings: Settings
  titles: string[]
  today: string
  onOpen: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const programTitle = settings.program[new Date().getDay()]
  const upcoming = workouts.filter(w => w.status === 'planned' && w.date > today).slice(0, 3)

  const begin = async (t: string, start: boolean) => {
    const norm = normalize(t)
    const tpl = norm ? [...workouts].reverse().find(w => normalize(w.title) === norm && w.exercises.length) : undefined
    const w = await createWorkout(today, t, { templateId: tpl?.id })
    if (start) await startWorkout(w.id)
    onOpen(w.id)
  }

  return (
    <div className="page">
      <div className="header"><div><p className="eyebrow">{fmtLong(today)}</p><h1 className="title">Тренировка</h1></div></div>
      {programTitle && (
        <section className="card">
          <div className="card-head"><h2>Сегодня по программе</h2><Badge status="planned">{fmtRelative(today)}</Badge></div>
          <h3 className="card-title">{programTitle}</h3>
          <button className="pill dark lg block" onClick={() => begin(programTitle, true)}><Icon name="play" size={15} />Начать «{programTitle}»</button>
        </section>
      )}
      <section className="card">
        <div className="card-head"><h2>{programTitle ? 'Или другая тренировка' : 'Свободная тренировка'}</h2></div>
        <input className="text-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Спина / Плечи" enterKeyHint="go" onKeyDown={e => e.key === 'Enter' && begin(title, true)} />
        {titles.length > 0 && <div className="chips">{titles.slice(0, 8).map(t => <button key={t} className={`chip ${t === title ? 'on' : ''}`} onClick={() => setTitle(t)}>{t}</button>)}</div>}
        <button className="pill dark block" onClick={() => begin(title, true)}><Icon name="play" size={15} />Начать</button>
      </section>
      {upcoming.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Запланировано</h2></div>
          <div className="list">
            {upcoming.map(w => (
              <button key={w.id} onClick={() => onOpen(w.id)} style={{ textAlign: 'left' }}>
                <span className="grow"><b>{w.title || 'Без названия'}</b><br /><em>{fmtRelative(w.date, today)}{w.time ? ` · ${w.time}` : ''}</em></span>
                <Icon name="right" size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
