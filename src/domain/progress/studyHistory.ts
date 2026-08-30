import type { DailySession } from '../../types/app'
import { addLocalDays, localDateOrdinal, startOfLocalWeek, toLocalDateKey } from '../../utils/date'

export interface WeeklyStudyDay {
  date: string
  label: string
  studied: boolean
  isToday: boolean
}

export interface StudyStats {
  totalStudyDays: number
  currentStreak: number
  bestStreak: number
  weeklyStudyDays: WeeklyStudyDay[]
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const

export function getStudyDateKeys(sessions: DailySession[]): string[] {
  return [...new Set(
    sessions
      .filter((session) => session.completed && session.questions.length === 10)
      .map((session) => session.date),
  )].sort()
}

function calculateBestStreak(dateKeys: string[]): number {
  let best = 0
  let current = 0
  let previousOrdinal: number | null = null

  for (const dateKey of dateKeys) {
    const ordinal = localDateOrdinal(dateKey)
    current = previousOrdinal !== null && ordinal === previousOrdinal + 1
      ? current + 1
      : 1
    best = Math.max(best, current)
    previousOrdinal = ordinal
  }

  return best
}

function calculateCurrentStreak(dateKeys: string[], referenceDate: Date): number {
  if (dateKeys.length === 0) return 0
  const todayOrdinal = localDateOrdinal(toLocalDateKey(referenceDate))
  const lastOrdinal = localDateOrdinal(dateKeys[dateKeys.length - 1])
  if (todayOrdinal - lastOrdinal > 1 || lastOrdinal > todayOrdinal) return 0

  let streak = 1
  for (let index = dateKeys.length - 2; index >= 0; index -= 1) {
    const newer = localDateOrdinal(dateKeys[index + 1])
    const older = localDateOrdinal(dateKeys[index])
    if (newer - older !== 1) break
    streak += 1
  }
  return streak
}

export function calculateStudyStats(
  sessions: DailySession[],
  referenceDate: Date = new Date(),
): StudyStats {
  const dateKeys = getStudyDateKeys(sessions)
  const studied = new Set(dateKeys)
  const weekStart = startOfLocalWeek(referenceDate)
  const todayKey = toLocalDateKey(referenceDate)
  const weeklyStudyDays = WEEKDAY_LABELS.map((label, index) => {
    const date = toLocalDateKey(addLocalDays(weekStart, index))
    return { date, label, studied: studied.has(date), isToday: date === todayKey }
  })

  return {
    totalStudyDays: dateKeys.length,
    currentStreak: calculateCurrentStreak(dateKeys, referenceDate),
    bestStreak: calculateBestStreak(dateKeys),
    weeklyStudyDays,
  }
}
