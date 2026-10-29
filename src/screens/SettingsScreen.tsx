import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, NumberField, Segmented, Sheet, confirmAsk, useToast } from '../ui'
import { ExercisePicker } from '../components/ExercisePicker'
import type { BodyEntry, Exercise, Workout } from '../domain/types'
import { requestPersistence, setSetting, type Settings } from '../db/db'
import { BackupError, exportBackup, importBackup } from '../db/backup'
import { mergeExercises, setBodyWeight, wipeAll } from '../db/repo'
import { loadDemo } from '../db/demo'
import { dkey, fmtShort } from '../domain/dates'
import type { ThemePref } from '../theme'

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
        <button className="card tap" onClick={() => setPick('from')}>
          <span className="section-label" style={{ marginTop: 0 }}>Дубль</span>
          <div className="stack"><b>{from ? from.name : 'Выбрать…'}</b>{from && <span className="muted small">{uses(from.id)} тренировок</span>}</div>
        </button>
        <div className="center muted"><Icon name="merge" /></div>
        <button className="card tap" onClick={() => setPick('to')}>
          <span className="section-label" style={{ marginTop: 0 }}>Основное упражнение</span>
          <div className="stack"><b>{to ? to.name : 'Выбрать…'}</b>{to && <span className="muted small">{uses(to.id)} тренировок</span>}</div>
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

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'system', label: 'Как в iOS' },
]

export function SettingsScreen({ settings, body, list, workouts, themePref, onTheme, onBack }: {
  settings: Settings
  body: BodyEntry[]
  list: Exercise[]
  workouts: Workout[]
  themePref: ThemePref
  onTheme: (p: ThemePref) => void
  onBack: () => void
}) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [merge, setMerge] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const today = dkey()
  const todayWeight = useMemo(() => body.find(b => b.date === today)?.kg ?? null, [body, today])
  const lastWeight = body.at(-1)?.kg
  useEffect(() => { requestPersistence().then(setPersisted) }, [])

  return (
    <div className="page">
      <div className="header">
        <div><p className="eyebrow">Форма · версия {__APP_VERSION__}</p><h1 className="title">Настройки</h1></div>
        <button className="icon-btn" onClick={onBack} aria-label="Назад"><Icon name="x" size={18} /></button>
      </div>

      <div className="settings-group">
        <span className="section-label">Оформление</span>
        <div className="card">
          <div className="row"><Icon name="palette" size={20} /><b className="grow">Тема</b></div>
          <Segmented value={themePref} options={THEMES} onChange={onTheme} />
        </div>
      </div>

      <div className="settings-group">
        <span className="section-label">Профиль</span>
        <div className="card rows">
          <div className="setting-row">
            <div className="label">Вес сегодня<small>{lastWeight ? `последний: ${String(lastWeight).replace('.', ',')} кг` : 'кг'}</small></div>
            <NumberField ariaLabel="Вес сегодня, кг" value={todayWeight} placeholder="кг" enterKeyHint="done"
              onCommit={n => { if (n && n > 25 && n < 300) setBodyWeight(today, n) }} />
          </div>
          <div className="setting-row">
            <div className="label">Рост<small>см, для расчёта ИМТ</small></div>
            <NumberField integer ariaLabel="Рост, см" value={settings.height} placeholder="см" enterKeyHint="done"
              onCommit={n => { if (n == null || (n > 100 && n < 250)) setSetting('height', n) }} />
          </div>
        </div>
      </div>

      <div className="settings-group">
        <span className="section-label">Данные</span>
        <div className="card">
          <div className="row">
            <Icon name="shield" size={20} />
            <div className="grow stack">
              <b>Копия данных</b>
              <span className="muted small">{settings.lastBackupAt ? `Последняя: ${fmtShort(dkey(new Date(settings.lastBackupAt)))}` : 'Ещё не сохранялась'}</span>
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
      </div>

      <div className="settings-group">
        <span className="section-label">Упражнения</span>
        <button className="card tap" style={{ flexDirection: 'row', alignItems: 'center' }} onClick={() => setMerge(true)}>
          <Icon name="merge" size={20} />
          <div className="grow stack"><b>Объединить дубли</b><span className="muted small">Если одно упражнение записано дважды</span></div>
          <Icon name="right" size={16} />
        </button>
      </div>

      <div className="settings-group">
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
      </div>

      <MergeSheet open={merge} onClose={() => setMerge(false)} list={list} workouts={workouts} />
    </div>
  )
}
