import { useEffect, useMemo, useState } from 'react'
import { Badge, Icon, Segmented, Sheet } from './ui.jsx'
import {
  CATEGORIES, CATEGORY_OF, LIBRARY, TITLE_PRESETS, dayStatus, fmt, fmtDay, fmtLong, latestWeight,
  pad, parseKey, previousByTitle, previousExercise, uid,
} from './store.js'

const num = v => String(v).replace(',', '.').replace(/[^\d.]/g, '')
const newSet = (w = '', r = '') => ({ id: uid(), w, r, done: false })

function useElapsed(since, active) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  if (!since) return null
  const s = Math.max(0, Math.floor((now - new Date(since)) / 1000))
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

function ExercisePicker({ open, onClose, onPick, custom }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const all = useMemo(() => [...Object.values(LIBRARY).flat(), ...custom], [custom])
  const list = all.filter(n => (cat === 'all' || CATEGORY_OF[n] === cat) && n.toLowerCase().includes(q.trim().toLowerCase()))
  const exact = all.some(n => n.toLowerCase() === q.trim().toLowerCase())
  const pick = name => { onPick(name); setQ('') }

  return (
    <Sheet open={open} onClose={onClose} title="Упражнение">
      <label className="search">
        <Icon name="search" size={16} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск или своё название" />
      </label>
      <div className="scroll-x">
        <Segmented small value={cat} onChange={setCat} options={[{ value: 'all', label: 'Все' }, ...CATEGORIES.map(c => ({ value: c, label: c }))]} />
      </div>
      <ul className="picker">
        {q.trim() && !exact && (
          <li><button className="picker-add" onClick={() => pick(q.trim())}><Icon name="plus" size={16} />Добавить «{q.trim()}»</button></li>
        )}
        {list.map(n => (
          <li key={n}><button onClick={() => pick(n)}><span>{n}</span><small>{CATEGORY_OF[n] ?? 'Своё'}</small></button></li>
        ))}
      </ul>
    </Sheet>
  )
}

function ExerciseCard({ ex, index, prev, onChange, onRemove, onSetDone }) {
  const setField = (id, field, value) => onChange(e => { const s = e.sets.find(x => x.id === id); s[field] = value })
  const addSet = () => onChange(e => { const l = e.sets.at(-1); e.sets.push(newSet(l?.w ?? '', l?.r ?? '')) })
  const removeSet = id => onChange(e => { e.sets = e.sets.filter(s => s.id !== id) })
  const prevBest = prev && prev.ex.sets.filter(s => s.done).sort((a, b) => b.w - a.w)[0]
  const allDone = ex.sets.length > 0 && ex.sets.every(s => s.done)

  return (
    <section className={`card ex-card ${allDone ? 'complete' : ''}`}>
      <div className="ex-head">
        <span className="ex-index">{allDone ? <Icon name="check" size={14} stroke={2.4} /> : index + 1}</span>
        <div>
          <h3>{ex.name}</h3>
          <small>{CATEGORY_OF[ex.name] ?? 'Своё упражнение'}</small>
        </div>
        <button className="icon-btn sm ghost" onClick={onRemove} aria-label="Удалить упражнение"><Icon name="trash" size={16} /></button>
      </div>

      {prev && (
        <p className="prev">
          Прошлый раз · {fmtDay(prev.date)}: <b>{fmt(prevBest.w)} кг × {prevBest.r}</b>, {prev.ex.sets.filter(s => s.done).length} подх.
        </p>
      )}

      <div className="sets">
        <div className="sets-row sets-head"><span>Подход</span><span>Вес, кг</span><span>Повторы</span><span /></div>
        {ex.sets.map((s, i) => (
          <div key={s.id} className={`sets-row ${s.done ? 'done' : ''}`}>
            <button className="set-no" onClick={() => !s.done && ex.sets.length > 1 && removeSet(s.id)} title="Удалить подход">{i + 1}</button>
            <input inputMode="decimal" value={s.w} placeholder={prev?.ex.sets[i]?.w ?? '0'} onChange={e => setField(s.id, 'w', num(e.target.value))} />
            <input inputMode="numeric" value={s.r} placeholder={prev?.ex.sets[i]?.r ?? '0'} onChange={e => setField(s.id, 'r', num(e.target.value))} />
            <button
              className={`set-check ${s.done ? 'on' : ''}`}
              aria-label="Подход выполнен"
              onClick={() => {
                const done = !s.done
                onChange(e => {
                  const t = e.sets.find(x => x.id === s.id)
                  t.done = done
                  // если поля пустые — подставляем прошлый результат
                  if (done && !t.w && prev?.ex.sets[i]) t.w = prev.ex.sets[i].w
                  if (done && !t.r && prev?.ex.sets[i]) t.r = prev.ex.sets[i].r
                })
                if (done) onSetDone(ex.sets.filter(x => x.done).length + 1 === ex.sets.length)
              }}
            >
              <Icon name="check" size={16} stroke={2.4} />
            </button>
          </div>
        ))}
      </div>
      <button className="pill ghost block" onClick={addSet}><Icon name="plus" size={16} />Подход</button>
    </section>
  )
}

export default function Workout({ date, data, update, onClose, onRest }) {
  const w = data.workouts[date] ?? { title: '', status: 'planned', bodyWeight: null, exercises: [] }
  const status = dayStatus(w, date)
  const [picker, setPicker] = useState(false)
  const elapsed = useElapsed(w.startedAt, w.status === 'active')

  const mutate = fn => update(d => {
    d.workouts[date] ??= { title: '', status: 'planned', bodyWeight: latestWeight(d), exercises: [] }
    fn(d.workouts[date], d)
  })
  const start = wk => { if (wk.status !== 'done' && wk.status !== 'active') { wk.status = 'active'; wk.startedAt = new Date().toISOString() } }

  const template = !w.exercises.length ? previousByTitle(data, w.title, date) : null

  const finish = () => mutate((wk, d) => {
    wk.status = 'done'
    wk.startedAt ??= new Date().toISOString()
    wk.finishedAt = new Date().toISOString()
    wk.exercises.forEach(e => { e.sets = e.sets.filter(s => s.done || s.w || s.r) })
    if (wk.bodyWeight) {
      d.weightLog = d.weightLog.filter(x => x.date !== date)
      d.weightLog.push({ date, kg: +wk.bodyWeight })
      d.weightLog.sort((a, b) => (a.date < b.date ? -1 : 1))
    }
  })

  const remove = () => {
    if (!confirm('Удалить тренировку этого дня?')) return
    update(d => { delete d.workouts[date] })
    onClose()
  }

  return (
    <div className="page workout">
      <header className="w-top">
        <button className="icon-btn" onClick={onClose} aria-label="Назад"><Icon name="left" /></button>
        <div className="w-top-mid">
          <b>{fmtLong(parseKey(date))}</b>
          {elapsed && w.status === 'active' ? <span className="timer-pill"><i />{elapsed}</span> : <Badge status={status} />}
        </div>
        <button className="icon-btn" onClick={remove} aria-label="Удалить" disabled={!data.workouts[date]}><Icon name="trash" size={17} /></button>
      </header>

      <section className="card">
        <label className="field-label">Название дня</label>
        <input className="title-input" value={w.title} placeholder="Например: Спина / Плечи" onChange={e => mutate(wk => { wk.title = e.target.value })} />
        <div className="chips">
          {TITLE_PRESETS.map(t => (
            <button key={t} className={w.title === t ? 'on' : ''} onClick={() => mutate(wk => { wk.title = t })}>{t}</button>
          ))}
        </div>
        <div className="bw-row">
          <span><Icon name="scale" size={16} />Личный вес</span>
          <label className="unit-input">
            <input inputMode="decimal" value={w.bodyWeight ?? ''} placeholder={fmt(latestWeight(data) ?? 0)} onChange={e => mutate(wk => { wk.bodyWeight = num(e.target.value) })} />
            <small>кг</small>
          </label>
        </div>
      </section>

      {template && (
        <button className="card template" onClick={() => mutate(wk => {
          wk.exercises = template[1].exercises.map(e => ({ id: uid(), name: e.name, sets: e.sets.map(s => newSet(s.w, s.r)) }))
        })}>
          <span className="chip-icon"><Icon name="copy" size={16} /></span>
          <div><b>Повторить «{template[1].title}»</b><small>{fmtDay(template[0])} · {template[1].exercises.length} упражнения с прошлыми весами</small></div>
          <Icon name="right" size={16} />
        </button>
      )}

      {w.exercises.map((ex, i) => (
        <ExerciseCard
          key={ex.id}
          ex={ex}
          index={i}
          prev={previousExercise(data, ex.name, date)}
          onChange={fn => mutate(wk => { fn(wk.exercises.find(e => e.id === ex.id)) })}
          onRemove={() => mutate(wk => { wk.exercises = wk.exercises.filter(e => e.id !== ex.id) })}
          onSetDone={exerciseDone => {
            mutate(start)
            onRest(exerciseDone ? data.profile.rest + 60 : data.profile.rest, exerciseDone ? `${ex.name} — готово` : 'Отдых')
          }}
        />
      ))}

      <button className="add-ex" onClick={() => setPicker(true)}>
        <Icon name="plus" size={20} />
        <span>Добавить упражнение</span>
      </button>

      <div className="w-bottom">
        {w.status === 'done' ? (
          <button className="pill block ghost" onClick={() => mutate(wk => { wk.status = 'active'; wk.finishedAt = null })}>
            <Icon name="edit" size={16} />Тренировка завершена · изменить
          </button>
        ) : (
          <button className="pill dark block" disabled={!w.exercises.some(e => e.sets.some(s => s.done))} onClick={finish}>
            <Icon name="check" size={16} stroke={2.4} />Завершить тренировку
          </button>
        )}
      </div>

      <ExercisePicker
        open={picker}
        custom={data.custom}
        onClose={() => setPicker(false)}
        onPick={name => {
          setPicker(false)
          const prev = previousExercise(data, name, date)
          mutate((wk, d) => {
            if (!CATEGORY_OF[name] && !d.custom.includes(name)) d.custom.push(name)
            const sets = prev ? prev.ex.sets.filter(s => s.done).map(() => newSet()) : [newSet(), newSet(), newSet()]
            wk.exercises.push({ id: uid(), name, sets })
          })
        }}
      />
    </div>
  )
}
