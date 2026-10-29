import { useMemo, useState } from 'react'
import { Icon, Sheet } from '../ui'
import { CATEGORIES, findExact, findSimilar, search } from '../domain/exercises'
import type { Category, Exercise, ExerciseKind } from '../domain/types'
import { ensureExercise } from '../db/repo'

const KINDS: { value: ExerciseKind; label: string }[] = [
  { value: 'weight', label: 'С весом' },
  { value: 'bodyweight', label: 'Свой вес' },
  { value: 'time', label: 'На время' },
]

/**
 * Выбор упражнения с защитой от дублей:
 * точное совпадение по синониму выбирается сразу, похожее — предлагается вопросом,
 * новое создаётся только явной кнопкой с выбором группы мышц.
 */
export function ExercisePicker({ open, onClose, list, onPick, title = 'Упражнение' }: {
  open: boolean
  onClose: () => void
  list: Exercise[]
  onPick: (e: Exercise) => void
  title?: string
}) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)
  const [newCat, setNewCat] = useState<Category>('Другое')
  const [newKind, setNewKind] = useState<ExerciseKind>('weight')

  const results = useMemo(() => search(list, q, cat ?? undefined), [list, q, cat])
  const exact = q.trim() ? findExact(list, q) : undefined
  const similar = q.trim() && !exact ? findSimilar(list, q) : undefined

  const reset = () => { setQ(''); setCat(null); setCreating(false); setNewKind('weight'); setNewCat('Другое') }
  const pick = (e: Exercise) => { onPick(e); reset() }
  const close = () => { reset(); onClose() }

  return (
    <Sheet open={open} onClose={close} title={title} tall>
      <div className="picker-top">
        <label className="search">
          <Icon name="search" size={18} />
          <input value={q} onChange={e => { setQ(e.target.value); setCreating(false) }} placeholder="Название или синоним" autoCorrect="off" autoCapitalize="sentences" enterKeyHint="search" />
          {q && <button className="icon-btn ghost sm" onClick={() => { setQ(''); setCreating(false) }} aria-label="Очистить"><Icon name="x" size={15} /></button>}
        </label>
        {!q && (
          <div className="chips">
            <button className={`chip ${cat == null ? 'on' : ''}`} onClick={() => setCat(null)}>Все</button>
            {CATEGORIES.map(c => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        )}
        {similar && !creating && (
          <div className="banner info">
            <span className="grow">Похоже на <b>«{similar.name}»</b>. Это оно?</span>
            <button className="pill sm dark" onClick={() => pick(similar)}>Да</button>
          </div>
        )}
      </div>

      {creating ? (
        <div className="card">
          <b>Новое упражнение «{q.trim()}»</b>
          <span className="section-label">Группа мышц</span>
          <div className="chips wrap">{CATEGORIES.map(c => <button key={c} className={`chip ${newCat === c ? 'on' : ''}`} onClick={() => setNewCat(c)}>{c}</button>)}</div>
          <span className="section-label">Тип</span>
          <div className="chips wrap">{KINDS.map(k => <button key={k.value} className={`chip ${newKind === k.value ? 'on' : ''}`} onClick={() => setNewKind(k.value)}>{k.label}</button>)}</div>
          <button className="pill dark block lg" onClick={async () => pick(await ensureExercise(q, newCat, newKind))}>Создать и добавить</button>
        </div>
      ) : (
        <div className="picker">
          {q.trim() && !exact && (
            <button className="accent" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Создать «{q.trim()}»</button>
          )}
          {results.map(e => (
            <button key={e.id} onClick={() => pick(e)}><span>{e.name}</span><small>{e.category}</small></button>
          ))}
          {!results.length && <p className="muted picker-empty">{q.trim() ? 'В справочнике такого нет — создайте новое выше' : 'Нет упражнений в этой группе'}</p>}
        </div>
      )}
    </Sheet>
  )
}
