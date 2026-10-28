import { useEffect, useState } from 'react'
import Home from './Home.jsx'
import Gym from './Gym.jsx'
import Workout from './Workout.jsx'
import { Gauge, Icon, Sheet } from './ui.jsx'
import { dkey, latestWeight, pad, useStore } from './store.js'

function RestTimer({ rest, setRest }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
  useEffect(() => {
    if (left > 0) return
    navigator.vibrate?.([200, 100, 200])
    const t = setTimeout(() => setRest(null), 4000)
    return () => clearTimeout(t)
  }, [left === 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const shift = s => setRest(r => ({ ...r, endsAt: Math.max(Date.now(), r.endsAt + s * 1000), total: Math.max(15, r.total + s) }))

  return (
    <div className={`rest ${left === 0 ? 'over' : ''}`}>
      <Gauge value={left / rest.total} size={64} stroke={5} sweep={360} color={left === 0 ? 'var(--green)' : 'var(--orange)'}>
        <Icon name={left === 0 ? 'check' : 'clock'} size={18} />
      </Gauge>
      <div className="rest-mid">
        <span>{left === 0 ? 'Пора! Следующий подход' : rest.label}</span>
        <b>{Math.floor(left / 60)}:{pad(left % 60)}</b>
      </div>
      <div className="rest-btns">
        <button onClick={() => shift(-15)}>−15</button>
        <button onClick={() => shift(15)}>+15</button>
        <button className="dark" onClick={() => setRest(null)} aria-label="Пропустить"><Icon name="x" size={16} /></button>
      </div>
    </div>
  )
}

function Settings({ open, onClose, data, update, reset }) {
  const [form, setForm] = useState({})
  useEffect(() => {
    if (open) setForm({ height: data.profile.height, weight: latestWeight(data) ?? '', water: data.profile.waterGoal / 1000, rest: data.profile.rest })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value.replace(',', '.') }))
  const save = () => {
    update(d => {
      d.profile.height = +form.height || d.profile.height
      d.profile.waterGoal = Math.round((+form.water || 3) * 1000)
      d.profile.rest = +form.rest || 90
      if (+form.weight && +form.weight !== latestWeight(d)) {
        const today = dkey()
        d.weightLog = d.weightLog.filter(x => x.date !== today)
        d.weightLog.push({ date: today, kg: +form.weight })
      }
    })
    onClose()
  }
  const rows = [
    ['weight', 'Вес сегодня', 'кг'], ['height', 'Рост', 'см'], ['water', 'Норма воды', 'л'], ['rest', 'Отдых между подходами', 'сек'],
  ]
  return (
    <Sheet open={open} onClose={onClose} title="Профиль">
      <div className="form">
        {rows.map(([k, label, unit]) => (
          <div className="bw-row" key={k}>
            <span>{label}</span>
            <label className="unit-input"><input inputMode="decimal" value={form[k] ?? ''} onChange={set(k)} /><small>{unit}</small></label>
          </div>
        ))}
      </div>
      <button className="pill dark block" onClick={save}>Сохранить</button>
      <button className="link danger" onClick={() => { if (confirm('Стереть все данные и вернуть демо?')) { reset(); onClose() } }}>Сбросить к демо-данным</button>
    </Sheet>
  )
}

export default function App() {
  const { data, update, reset } = useStore()
  const [tab, setTab] = useState('home')
  const [day, setDay] = useState(null)
  const [rest, setRest] = useState(null)
  const [settings, setSettings] = useState(false)

  useEffect(() => { window.scrollTo(0, 0) }, [tab, day])

  const openDay = key => { setDay(key); setTab('gym') }

  return (
    <div className="app">
      {!day && (
        <header className="topbar">
          <div className="brand">
            <span className="logo"><Icon name="dumbbell" size={20} stroke={2.4} /></span>
            <b>Форма</b>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Профиль"><Icon name="gear" /></button>
          </div>
        </header>
      )}

      {day ? (
        <Workout date={day} data={data} update={update} onClose={() => setDay(null)}
          onRest={(sec, label) => setRest({ endsAt: Date.now() + sec * 1000, total: sec, label })} />
      ) : tab === 'home' ? (
        <Home data={data} update={update} onOpenDay={openDay} />
      ) : (
        <Gym data={data} onOpenDay={setDay} />
      )}

      {rest && <RestTimer rest={rest} setRest={setRest} />}

      {!day && (
        <nav className="tabbar">
          <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')}><Icon name="grid" size={17} />Главная</button>
          <button className={tab === 'gym' ? 'on' : ''} onClick={() => setTab('gym')}><Icon name="dumbbell" size={18} stroke={2.2} />Зал</button>
        </nav>
      )}

      <Settings open={settings} onClose={() => setSettings(false)} data={data} update={update} reset={reset} />
    </div>
  )
}
