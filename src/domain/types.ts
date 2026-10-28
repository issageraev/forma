export type Category = 'Грудь' | 'Спина' | 'Ноги' | 'Плечи' | 'Руки' | 'Пресс' | 'Другое'

/** weight — вес снаряда; bodyweight — свой вес (+ отягощение в w); time — подход в секундах (r) */
export type ExerciseKind = 'weight' | 'bodyweight' | 'time'

export interface Exercise {
  id: string
  name: string
  aliases: string[]
  category: Category
  kind: ExerciseKind
  custom?: boolean
  /** после слияния упражнение скрыто, история переписана на mergedInto */
  archived?: boolean
  mergedInto?: string
}

export interface SetEntry {
  id: string
  /** кг; для bodyweight — дополнительный вес */
  w: number | null
  /** повторы; для time — секунды */
  r: number | null
  done: boolean
  doneAt?: number
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  sets: SetEntry[]
}

export type WorkoutStatus = 'planned' | 'active' | 'done'
export type DayStatus = WorkoutStatus | 'missed'

export interface Workout {
  id: string
  /** YYYY-MM-DD в локальном времени */
  date: string
  title: string
  status: WorkoutStatus
  time?: string
  startedAt?: number
  finishedAt?: number
  lastActivityAt?: number
  autoFinished?: boolean
  bodyWeight?: number | null
  exercises: WorkoutExercise[]
  createdAt: number
  updatedAt: number
}

export interface BodyEntry {
  date: string
  kg: number
}

/** 0 = воскресенье … 6 = суббота, как Date.getDay() */
export type WeekProgram = Partial<Record<number, string>>
