import { useEffect, useMemo } from 'react'
import { STATUS_LABEL } from './store.js'

const PATHS = {
  dumbbell: 'M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13',
  drop: 'M12 3.5s6 6.4 6 10.7a6 6 0 0 1-12 0c0-4.3 6-10.7 6-10.7z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  scale: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM8.5 10a5 5 0 0 1 7 0M12 10l1.2-1.6',
  ruler: 'M3.5 16.5l13-13 4 4-13 13zM7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
}

export function Icon({ name, size = 18, stroke = 1.8, className = '' }) {
  if (name === 'grid') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="3" width="8" height="8" rx="2.4" /><rect x="13" y="3" width="8" height="8" rx="4" />
        <rect x="3" y="13" width="8" height="8" rx="2.4" /><rect x="13" y="13" width="8" height="8" rx="2.4" />
      </svg>
    )
  }
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  )
}

export function Badge({ status, children }) {
  return <span className={`badge badge-${status}`}><i />{children ?? STATUS_LABEL[status]}</span>
}

/* «Штрихкод»-спарклайн из референса: светлые штрихи, свежий участок — плотный тёмный блок */
export function Barcode({ values, bars = 46, accent = 0.3 }) {
  const heights = useMemo(() => {
    if (!values.length) return Array(bars).fill(0.3)
    const min = Math.min(...values), max = Math.max(...values)
    return Array.from({ length: bars }, (_, i) => {
      const t = (i / (bars - 1)) * (values.length - 1)
      const a = values[Math.floor(t)], b = values[Math.ceil(t)]
      const v = a + (b - a) * (t - Math.floor(t))
      const norm = max === min ? 0.5 : (v - min) / (max - min)
      return 0.25 + norm * 0.55 + (Math.sin(i * 2.7) + 1) * 0.06
    })
  }, [values, bars])
  const from = Math.round(bars * (1 - accent) * 0.62)
  const to = from + Math.round(bars * accent)
  return (
    <div className="barcode">
      {heights.map((h, i) => {
        const hot = i >= from && i < to
        return <span key={i} className={hot ? 'hot' : ''} style={{ height: `${hot ? 100 : h * 70}%` }} />
      })}
    </div>
  )
}

const polar = (cx, cy, r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] }
const arc = (cx, cy, r, from, to) => {
  const [x1, y1] = polar(cx, cy, r, from), [x2, y2] = polar(cx, cy, r, to)
  return `M${x1} ${y1} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

/* Дуговой индикатор, как CPU/RAM в референсе */
export function Gauge({ value, size = 120, color = 'var(--violet)', stroke = 7, sweep = 240, children }) {
  const r = size / 2 - stroke
  const start = -sweep / 2
  const end = start + sweep * Math.min(1, Math.max(0, value))
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <path d={arc(size / 2, size / 2, r, start, start + sweep)} stroke="var(--track)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {value > 0.005 && <path d={arc(size / 2, size / 2, r, start, end)} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" style={{ transition: 'd .5s ease' }} />}
      </svg>
      <div className="gauge-label">{children}</div>
    </div>
  )
}

const smooth = pts => pts.reduce((d, [x, y], i, a) => {
  if (!i) return `M${x} ${y}`
  const [px, py] = a[i - 1], cx = (px + x) / 2
  return `${d} C${cx} ${py} ${cx} ${y} ${x} ${y}`
}, '')

/* Линейный график в духе «Agent Activity»: штриховка по краям, маркер и стеклянная подсказка */
export function LineChart({ points, labels, color = 'var(--orange)', unit = 'кг', note }) {
  const W = 340, H = 190, L = 30, R = 8, T = 64, B = 24
  if (points.length < 2) return <div className="chart-empty">Нужно хотя бы 2 тренировки с этим упражнением</div>
  const step = Math.max(5, Math.ceil((Math.max(...points) - Math.min(...points) + 4) / 3 / 5) * 5)
  const min = Math.floor((Math.min(...points) - 2) / 5) * 5
  const max = min + step * 3
  const x = i => L + (i / (points.length - 1)) * (W - L - R)
  const y = v => T + (1 - (v - min) / (max - min)) * (H - T - B)
  const pts = points.map((v, i) => [x(i), y(v)])
  const ticks = [0, 1, 2, 3].map(i => min + ((max - min) * i) / 3)
  const peak = points.lastIndexOf(Math.max(...points))
  const delta = ((points.at(-1) - points[0]) / points[0]) * 100
  const peakPct = (x(peak) / W) * 100
  const tipStyle = peakPct > 50 ? { right: `${100 - peakPct + 3}%` } : { left: `${peakPct + 3}%` }

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,.05)" strokeWidth="2" />
          </pattern>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#E2843A" stopOpacity=".18" /><stop offset="1" stopColor="#E2843A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={L} y={T} width={(W - L - R) * 0.28} height={H - T - B} fill="url(#hatch)" />
        <rect x={W - R - (W - L - R) * 0.18} y={T} width={(W - L - R) * 0.18} height={H - T - B} fill="url(#hatch)" />
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(0,0,0,.09)" strokeDasharray="4 4" />
            <text x={0} y={y(t) + 4} className="chart-tick">{Math.round(t)}</text>
          </g>
        ))}
        <path d={`${smooth(pts)} L${x(points.length - 1)} ${H - B} L${L} ${H - B} Z`} fill="url(#fill)" />
        <path d={smooth(pts)} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
        <line x1={x(peak)} x2={x(peak)} y1={y(points[peak])} y2={H - B} stroke={color} strokeWidth="1.6" />
        <circle cx={x(peak)} cy={y(points[peak])} r="5" fill={color} stroke="#fff" strokeWidth="2" />
        {labels.map((l, i) => (i % Math.ceil(labels.length / 5) === 0 || i === labels.length - 1) && (
          <text key={i} x={x(i)} y={H - 4} textAnchor="middle" className="chart-tick">{l}</text>
        ))}
      </svg>
      <div className="chart-tip" style={tipStyle}>
        <b>{delta >= 0 ? '+' : ''}{delta.toFixed(1).replace('.', ',')}%</b>
        <span>{note ?? `Рекорд ${points[peak]} ${unit}`}</span>
      </div>
    </div>
  )
}

export function Segmented({ options, value, onChange, small }) {
  return (
    <div className={`seg ${small ? 'seg-sm' : ''}`}>
      {options.map(o => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn sm" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
