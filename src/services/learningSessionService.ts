import type { AppRepository } from '../repositories/AppRepository'
import { calculateStudyStats, type StudyStats } from '../domain/progress/studyHistory'
import { addSessionReward, calculateEarnedPoints } from '../domain/rewards/reward'
import { updateTownState, type TownItemId } from '../domain/town/town'
import type {
  AppData,
  DailySession,
  Grade,
  QuestionResult,
  RewardState,
  SkillProgress,
  TownState,
} from '../types/app'
import { toLocalDateKey } from '../utils/date'

export interface CompletedSessionInput {
  sessionId: string
  grade: Grade
  startedAt: string
  completedAt: string
  results: QuestionResult[]
}

export interface CompletedLearningSessionResult {
  session: DailySession
  rewardState: RewardState
  townState: TownState
  studyStats: StudyStats
  newlyUnlockedTownItemIds: TownItemId[]
}

export function createDailySession(input: CompletedSessionInput): DailySession {
  if (input.results.length !== 10) {
    throw new Error('完了セッションには10問の結果が必要です。')
  }
  const score = input.results.filter((result) => result.firstAttemptCorrect).length
  return {
    id: input.sessionId,
    date: toLocalDateKey(new Date(input.completedAt)),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    grade: input.grade,
    questions: input.results,
    completed: true,
    score,
    earnedPoints: calculateEarnedPoints(score),
  }
}

function laterTimestamp(current: string | null, candidate: string): string {
  if (!current) return candidate
  return Date.parse(candidate) >= Date.parse(current) ? candidate : current
}

export function calculateSkillProgress(
  currentProgress: AppData['skillProgress'],
  results: QuestionResult[],
): SkillProgress[] {
  const updated = new Map<string, SkillProgress>()

  for (const result of results) {
    const current = updated.get(result.skillId) ?? currentProgress[result.skillId] ?? {
      skillId: result.skillId,
      attempts: 0,
      correctCount: 0,
      recentResults: [],
      recentAccuracy: 0,
      level: 1,
      lastStudiedAt: null,
    }
    const recentResults = [...current.recentResults, result.firstAttemptCorrect].slice(-10)
    const recentCorrect = recentResults.filter(Boolean).length

    updated.set(result.skillId, {
      ...current,
      attempts: current.attempts + 1,
      correctCount: current.correctCount + (result.firstAttemptCorrect ? 1 : 0),
      recentResults,
      recentAccuracy: recentResults.length === 0 ? 0 : recentCorrect / recentResults.length,
      lastStudiedAt: laterTimestamp(current.lastStudiedAt, result.answeredAt),
    })
  }

  return [...updated.values()]
}

export async function saveCompletedLearningSession(
  repository: AppRepository,
  input: CompletedSessionInput,
): Promise<CompletedLearningSessionResult> {
  const appData = await repository.getAppData()
  const existing = appData.sessions.find((session) => session.id === input.sessionId)
  if (existing) {
    if (appData.inProgressSession) {
      await repository.saveCompletedSession(
        existing,
        [],
        appData.rewardState,
        appData.townState,
      )
    }
    return {
      session: existing,
      rewardState: appData.rewardState,
      townState: appData.townState,
      studyStats: calculateStudyStats(appData.sessions, new Date(input.completedAt)),
      newlyUnlockedTownItemIds: [],
    }
  }

  const session = createDailySession(input)
  const progress = calculateSkillProgress(appData.skillProgress, input.results)
  const rewardState = addSessionReward(appData.rewardState, session.earnedPoints)
  const studyStats = calculateStudyStats(
    [...appData.sessions, session],
    new Date(input.completedAt),
  )
  const { townState, newlyUnlockedItemIds } = updateTownState(
    appData.townState,
    studyStats.totalStudyDays,
  )

  await repository.saveCompletedSession(
    session,
    progress,
    rewardState,
    townState,
  )
  return {
    session,
    rewardState,
    townState,
    studyStats,
    newlyUnlockedTownItemIds: newlyUnlockedItemIds,
  }
}
