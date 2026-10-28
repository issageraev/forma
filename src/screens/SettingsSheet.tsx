import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, NumberField, Sheet, confirmAsk, useToast } from '../ui'
import { ExercisePicker } from '../components/ExercisePicker'
import type { BodyEntry, Exercise, Workout } from '../domain/types'
import { requestPersistence, setSetting, type Settings } from '../db/db'
import { BackupError, exportBackup, importBackup } from '../db/backup'
import { mergeExercises, setBodyWeight, wipeAll } from '../db/repo'
import { loadDemo } from '../db/demo'
import { dkey, fmtShort } from '../domain/dates'

function MergeSheet({ open, onClose, list, workouts }: { open: boolean; onClose: () => void; list: Exercise[]; workouts: Workout[] }) {
  const toast = useToast()
  const [from, setFrom] = useState<Exercise | null>(null)
  const [to, setTo] = useState<Exercise | null>(null)
  const [pick, setPick] = useState<'from' | 'to' | null>(null)
  const uses = (id?: string) => workouts.filter(w => w.exercises.some(e => e.exerciseId === id)).length
  const close = () => { setFrom(null); setTo(null); onClose() }
  return (
    <>
      <Sheet open={open && !pick} onClose={close} title="Объединить дубли">
        <p className="note">Если одно упражнение записано под двумя названиями, объедините их: история перейдёт в основное, второе название станет синонимом и больше не создаст дубль.</p>
        <button className="card" style={{ textAlign: 'left' }} onClick={() => setPick('from')}>
          <span className="section-label">Дубль</span>
          <b>{from ? from.name : 'Выбрать…'}</b>
          {from && <span className="muted small">{uses(from.id)} тренировок</span>}
        </button>
        <div className="center muted"><Icon name="merge" /></div>
        <button className="card" style={{ textAlign: 'left' }} onClick={() => setPick('to')}>
          <span className="section-label">Основное упражнение</span>
          <b>{to ? to.name : 'Выбрать…'}</b>
          {to && <span className="muted small">{uses(to.id)} тренировок</span>}
        </button>
        <button className="pill dark block lg" disabled={!from || !to || from.id === to.id} onClick={async () => {
          if (!from || !to || !confirmAsk(`Объединить «${from.name}» в «${to.name}»?`)) return
          await mergeExercises(from.id, to.id)
          toast({ text: `«${from.name}» теперь синоним «${to.name}»` })
          close()
        }}>Объединить</button>
      </Sheet>
      <ExercisePicker
        open={pick != null}
        title={pick === 'from' ? 'Какое упражнение — дубль?' : 'Во что объединить?'}
        list={list}
        onClose={() => setPick(null)}
        onPick={e => { if (pick === 'from') setFrom(e); else setTo(e); setPick(null) }}
      />
    </>
  )
}

export function SettingsSheet({ open, onClose, settings, body, list, workouts }: {
  open: boolean
  onClose: () => void
  settings: Settings
  body: BodyEntry[]
  list: Exercise[]
  workouts: Workout[]
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [merge, setMerge] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const today = dkey()
  const todayWeight = useMemo(() => body.find(b => b.date === today)?.kg ?? null, [body, today])
  useEffect(() => { if (open) requestPersistence().then(setPersisted) }, [open])

  return (
    <>
      <Sheet open={open && !merge} onClose={onClose} title="Настройки">
        <span className="section-label">Профиль</span>
        <div className="card" style={{ padding: '6px 16px', gap: 0 }}>
          <div className="program-row" style={{ justifyContent: 'space-between' }}>
            <span className="grow" style={{ fontWeight: 500 }}>Вес сегодня, кг</span>
            <NumberField className="" ariaLabel="Вес сегодня" value={todayWeight} placeholder={body.at(-1) ? String(body.at(-1)!.kg).replace('.', ',') : '—'} enterKeyHint="done"
              onCommit={n => { if (n && n > 25 && n < 300) setBodyWeight(today, n) }} />
          </div>
          <div className="program-row" style={{ justifyContent: 'space-between', borderBottom: 0 }}>
            <span className="grow" style={{ fontWeight: 500 }}>Рост, см</span>
            <NumberField integer ariaLabel="Рост" value={settings.height} placeholder="—" enterKeyHint="done"
              onCommit={n => { if (n == null || (n > 100 && n < 250)) setSetting('height', n) }} />
          </div>
        </div>

        <span className="section-label">Данные</span>
        <div className="card">
          <div className="row">
            <Icon name="shield" size={20} />
            <div className="grow">
              <b>Копия данных</b>
              <div className="muted small">{settings.lastBackupAt ? `Последняя: ${fmtShort(dkey(new Date(settings.lastBackupAt)))}` : 'Ещё не сохранялась'}</div>
            </div>
          </div>
          <button className="pill dark block" onClick={async () => { if (await exportBackup()) toast({ text: 'Копия сохранена' }) }}><Icon name="download" size={16} />Сохранить копию</button>
          <button className="pill ghost block" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} />Восстановить из копии</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f || !confirmAsk('Текущие данные будут заменены данными из копии. Продолжить?')) return
            try {
              const r = await importBackup(f)
              toast({ text: `Восстановлено: ${r.workouts} тренировок` })
            } catch (err) {
              toast({ text: err instanceof BackupError ? err.message : 'Не удалось восстановить копию' })
            }
          }} />
          <p className="note">
            Всё хранится на этом телефоне и работает без интернета. Сохраняйте копию в «Файлы» или iCloud Drive раз в неделю — на Главной появится напоминание.
            {persisted === true && ' Хранилище защищено от автоочистки.'}
          </p>
        </div>

        <span className="section-label">Упражнения</span>
        <button className="card" style={{ flexDirection: 'row', alignItems: 'center', textAlign: 'left' }} onClick={() => setMerge(true)}>
          <Icon name="merge" size={20} /><div className="grow"><b>Объединить дубли</b><div className="muted small">Если одно упражнение записано дважды</div></div><Icon name="right" size={16} />
        </button>

        <span className="section-label">Прочее</span>
        <div className="row wrap">
          {!workouts.length && <button className="pill ghost" onClick={() => loadDemo()}>Заполнить демо-данными</button>}
          <button className="pill danger" onClick={async () => {
            if (!confirmAsk('Стереть ВСЕ тренировки, вес и настройки? Это нельзя отменить.')) return
            if (!confirmAsk('Точно? Сначала лучше сохранить копию.')) return
            await wipeAll()
            toast({ text: 'Данные стёрты' })
          }}><Icon name="trash" size={16} />Стереть всё</button>
        </div>
        <p className="note center">Форма · версия {__APP_VERSION__}</p>
      </Sheet>
      <MergeSheet open={open && merge} onClose={() => setMerge(false)} list={list} workouts={workouts} />
    </>
  )
}
