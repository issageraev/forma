import { useState } from 'react'
import { Badge, Icon } from './ui.jsx'
import { DOW_SHORT, MONTHS_SHORT, addDays, dayStatus, dkey, doneSets, fmt, startOfWeek, volume } from './store.js'

const weekNumber = d => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 864e5 + 1) / 7)
}

function DayTile({ date, workout, onOpen, wide }) {
  const key = dkey(date)
  const status = dayStatus(workout, key)
  const isToday = key === dkey()
  return (
    <button className={`tile tile-${status} ${isToday ? 'today' : ''} ${wide ? 'wide' : ''}`} onClick={() => onOpen(key)}>
      <div className="tile-top">
        <span className="tile-dow">{DOW_SHORT[date.getDay()]}</span>
        <span className="tile-date">{date.getDate()}</span>
      </div>
      {status === 'empty' ? (
        <div className="tile-empty"><Icon name="plus" size={18} /><span>{wide ? 'Воскресенье — день отдыха' : 'Тренировка'}</span></div>
      ) : (
        <>
          <div className="tile-title">{workout.title || 'Без названия'}</div>
          <div className="tile-foot">
            <Badge status={status} />
            {workout.exercises.length > 0 && <span className="tile-meta">{workout.exercises.length} упр · {doneSets(workout)} подх</span>}
          </div>
        </>
      )}
      {isToday && <span className="tile-today">Сегодня</span>}
    </button>
  )
}

export default function Gym({ data, onOpenDay }) {
  const [offset, setOffset] = useState(0)
  const monday = addDays(startOfWeek(new Date()), offset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sunday = days[6]
  const range = monday.getMonth() === sunday.getMonth()
    ? `${monday.getDate()} – ${sunday.getDate()} ${MONTHS_SHORT[sunday.getMonth()]}`
    : `${monday.getDate()} ${MONTHS_SHORT[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS_SHORT[sunday.getMonth()]}`

  const week = days.map(d => data.workouts[dkey(d)]).filter(w => w?.status === 'done')
  const tonnage = week.reduce((a, w) => a + volume(w), 0)
  const sets = week.reduce((a, w) => a + doneSets(w), 0)

  return (
    <div className="page">
      <p className="eyebrow">Неделя {weekNumber(monday)}</p>
      <h1 className="title">Зал</h1>

      <div className="week-nav">
        <button className="icon-btn" onClick={() => setOffset(o => o - 1)} aria-label="Прошлая неделя"><Icon name="left" /></button>
        <div className="week-range">
          <b>{range}</b>
          {offset !== 0 && <button className="link" onClick={() => setOffset(0)}>К текущей</button>}
        </div>
        <button className="icon-btn" onClick={() => setOffset(o => o + 1)} aria-label="Следующая неделя"><Icon name="right" /></button>
      </div>

      <div className="tiles">
        {days.slice(0, 6).map(d => <DayTile key={dkey(d)} date={d} workout={data.workouts[dkey(d)]} onOpen={onOpenDay} />)}
      </div>
      <DayTile wide date={sunday} workout={data.workouts[dkey(sunday)]} onOpen={onOpenDay} />

      <section className="card stats week-sum">
        <div className="stat"><span className="stat-num">{week.length}<small>/ 6</small></span><p className="stat-label">Тренировок</p></div>
        <div className="stat"><span className="stat-num">{sets}</span><p className="stat-label">Подходов</p></div>
        <div className="stat"><span className="stat-num">{fmt(tonnage / 1000)}<small>т</small></span><p className="stat-label">Тоннаж</p></div>
      </section>
    </div>
  )
}
