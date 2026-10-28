import { useMemo, useState } from 'react'
import { Badge, Barcode, Gauge, Icon, LineChart, Segmented } from './ui.jsx'
import {
  KEY_LIFTS, addDays, dkey, doneSets, duration, fmt, fmtDay, fmtLong, fmtMin, fmtShort,
  latestWeight, lastDone, liftHistory, parseKey, topSet, volume,
} from './store.js'

export default function Home({ data, update, onOpenDay }) {
  const today = dkey()
  const weight = latestWeight(data)
  const weekAgo = data.weightLog.at(-2)?.kg
  const height = data.profile.height
  const bmi = weight && height ? weight / (height / 100) ** 2 : null

  const water = data.water[today] || 0
  const goal = data.profile.waterGoal
  const addWater = ml => update(d => { d.water[today] = Math.max(0, (d.water[today] || 0) + ml) })

  const last = lastDone(data)
  const [lift, setLift] = useState(KEY_LIFTS[0].name)
  const history = useMemo(() => liftHistory(data, lift).slice(-8), [data, lift])

  const averages = useMemo(() => {
    const now = new Date()
    const from = dkey(addDays(now, -28)), prevFrom = dkey(addDays(now, -56))
    return KEY_LIFTS.map(l => {
      const all = liftHistory(data, l.name)
      const avg = list => (list.length ? list.reduce((a, x) => a + x.top, 0) / list.length : null)
      const cur = avg(all.filter(x => x.date >= from))
      const prev = avg(all.filter(x => x.date >= prevFrom && x.date < from))
      return { ...l, avg: cur, diff: cur != null && prev != null ? cur - prev : null }
    })
  }, [data])

  return (
    <div className="page">
      <p className="eyebrow">{fmtLong(new Date())}</p>
      <h1 className="title">Моя форма</h1>

      {/* Вес и рост */}
      <section className="card stats">
        <div className="stat">
          <div className="stat-top">
            <span className="stat-num">{weight ? fmt(weight) : '—'}<small>кг</small></span>
            <span className="chip-icon"><Icon name="scale" size={16} /></span>
          </div>
          <p className="stat-label">Вес тела</p>
          {weekAgo != null && weight != null && (
            <p className={`delta ${weight <= weekAgo ? 'down' : 'up'}`}>
              {weight - weekAgo > 0 ? '+' : ''}{fmt(weight - weekAgo)} кг за неделю
            </p>
          )}
          <Barcode values={data.weightLog.map(w => w.kg)} />
        </div>
        <div className="stat">
          <div className="stat-top">
            <span className="stat-num">{height}<small>см</small></span>
            <span className="chip-icon"><Icon name="ruler" size={16} /></span>
          </div>
          <p className="stat-label">Рост</p>
          {bmi && <p className="delta">ИМТ {fmt(bmi)}</p>}
          <div className="bmi-scale">
            <span style={{ left: `${Math.min(96, Math.max(4, ((bmi - 16) / 16) * 100))}%` }} />
          </div>
          <div className="bmi-legend"><span>16</span><span>норма</span><span>32</span></div>
        </div>
      </section>

      {/* Вода */}
      <section className="card water">
        <div className="card-head">
          <h2>Вода сегодня</h2>
          <Badge status={water >= goal ? 'done' : 'active'}>{water >= goal ? 'Норма' : `${Math.round((water / goal) * 100)}%`}</Badge>
        </div>
        <div className="water-body">
          <Gauge value={water / goal} size={132} stroke={8} color="var(--violet)">
            <b>{fmt(water / 1000, 2)} л</b>
            <span>из {fmt(goal / 1000)} л</span>
          </Gauge>
          <div className="water-actions">
            <button className="pill" onClick={() => addWater(250)}><Icon name="drop" size={16} />+250 мл</button>
            <button className="pill" onClick={() => addWater(500)}><Icon name="drop" size={16} />+500 мл</button>
            <button className="pill ghost" onClick={() => addWater(-250)} disabled={!water}><Icon name="undo" size={16} />−250</button>
          </div>
        </div>
        <div className="water-week">
          {Array.from({ length: 7 }, (_, i) => {
            const k = dkey(addDays(new Date(), i - 6))
            const v = data.water[k] || 0
            return (
              <div key={k} className={k === today ? 'today' : ''}>
                <span style={{ height: `${Math.min(100, (v / goal) * 100)}%` }} />
                <small>{fmtShort(parseKey(k)).slice(0, 2)}</small>
              </div>
            )
          })}
        </div>
      </section>

      {/* Последняя тренировка */}
      <section className="card">
        <div className="card-head">
          <h2>Последняя тренировка</h2>
          {last && <Badge status="done" />}
        </div>
        {last ? (
          <>
            <h3 className="workout-title">{last[1].title}</h3>
            <p className="muted">{fmtShort(parseKey(last[0]))} · {last[1].exercises.length} упражнения · {doneSets(last[1])} подходов</p>
            <div className="mini-stats">
              <div><Icon name="bolt" size={15} /><b>{fmt(volume(last[1]) / 1000)} т</b><span>Тоннаж</span></div>
              <div><Icon name="clock" size={15} /><b>{fmtMin(duration(last[1]))}</b><span>Время</span></div>
              <div><Icon name="scale" size={15} /><b>{last[1].bodyWeight ? fmt(last[1].bodyWeight) : '—'}</b><span>Вес, кг</span></div>
            </div>
            <ul className="ex-list">
              {last[1].exercises.map(ex => (
                <li key={ex.id}>
                  <span>{ex.name}</span>
                  <b>{fmt(topSet(ex))} кг × {ex.sets.filter(s => s.done)[0]?.r ?? '—'}</b>
                  <em>{ex.sets.filter(s => s.done).length} подх.</em>
                </li>
              ))}
            </ul>
            <button className="pill block" onClick={() => onOpenDay(last[0])}>Открыть тренировку <Icon name="right" size={16} /></button>
          </>
        ) : (
          <p className="muted">Пока пусто — начните первую тренировку в разделе «Зал».</p>
        )}
      </section>

      {/* Основные упражнения */}
      <section className="card">
        <div className="card-head">
          <h2>Основные упражнения</h2>
          <span className="muted small">рабочий вес</span>
        </div>
        <Segmented small value={lift} onChange={setLift} options={KEY_LIFTS.map(l => ({ value: l.name, label: l.short }))} />
        <LineChart
          points={history.map(h => h.top)}
          labels={history.map(h => fmtDay(h.date))}
          note={`${lift}: рабочий вес`}
        />
        <div className="lifts">
          {averages.map(l => (
            <button key={l.name} className={`lift ${l.name === lift ? 'on' : ''}`} onClick={() => setLift(l.name)}>
              <span className="lift-name">{l.name}</span>
              <b>{l.avg != null ? fmt(l.avg) : '—'}<small> кг</small></b>
              <span className={`delta ${l.diff > 0 ? 'good' : l.diff < 0 ? 'up' : ''}`}>
                {l.diff == null ? 'среднее за 4 нед.' : `${l.diff > 0 ? '▲ +' : l.diff < 0 ? '▼ ' : ''}${fmt(l.diff)} кг · ср. 4 нед.`}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
