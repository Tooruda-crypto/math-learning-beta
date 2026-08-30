import type {
  AppData,
  DailySession,
  Grade,
  InProgressSession,
  Profile,
  ProfileLearningData,
  QuestionResult,
  SkillProgress,
} from '../types/app'
import { calculateRewardLevel } from '../domain/rewards/reward'
import { getStudyDateKeys } from '../domain/progress/studyHistory'
import { updateTownState } from '../domain/town/town'

export const CURRENT_SCHEMA_VERSION = 4

export function createDefaultProfileLearningData(): ProfileLearningData {
  return {
    skillProgress: {},
    sessions: [],
    inProgressSession: null,
    rewardState: { points: 0, level: 1, unlockedItems: [] },
    townState: { unlockedTownItems: [] },
  }
}

export function createDefaultAppData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profiles: [],
    activeProfileId: null,
    profileData: {},
    profile: null,
    ...createDefaultProfileLearningData(),
    settings: { dailyQuestionCount: 10, hintsEnabled: true },
  }
}

interface LegacyDailySession extends Omit<DailySession, 'startedAt' | 'completedAt' | 'grade'> {
  startedAt?: string
  completedAt?: string
  grade?: Grade
}

interface StoredAppData extends Partial<Omit<AppData, 'sessions'>> {
  sessions?: unknown
}

function isStoredAppData(value: unknown): value is StoredAppData {
  return typeof value === 'object' && value !== null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isGrade(value: unknown): value is Grade {
  return value === 1 || value === 2 || value === 3
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function migrateProfile(value: unknown): Profile | null {
  if (!isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.nickname !== 'string' ||
    !value.nickname.trim() ||
    !isGrade(value.grade) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string') return null

  return value as unknown as Profile
}

function isQuestionResult(value: unknown): value is QuestionResult {
  return isRecord(value) &&
    typeof value.questionId === 'string' &&
    typeof value.skillId === 'string' &&
    typeof value.question === 'string' &&
    typeof value.correctAnswer === 'string' &&
    typeof value.selectedAnswer === 'string' &&
    typeof value.firstAttemptCorrect === 'boolean' &&
    (typeof value.retryCorrect === 'boolean' || value.retryCorrect === null) &&
    isFiniteNumber(value.responseTimeMs) && value.responseTimeMs >= 0 &&
    typeof value.answeredAt === 'string'
}

function migrateSessions(value: unknown, fallbackGrade: Grade): DailySession[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((candidate) => {
    if (!isRecord(candidate) ||
      typeof candidate.id !== 'string' ||
      typeof candidate.date !== 'string' ||
      !Array.isArray(candidate.questions) ||
      !candidate.questions.every(isQuestionResult)) return []

    const session = candidate as unknown as LegacyDailySession
    const firstAnsweredAt = session.questions[0]?.answeredAt
    const lastAnsweredAt = session.questions[session.questions.length - 1]?.answeredAt
    const completedAt = typeof session.completedAt === 'string'
      ? session.completedAt
      : lastAnsweredAt ?? `${session.date}T00:00:00.000Z`
    const score = isFiniteNumber(session.score)
      ? Math.max(0, session.score)
      : session.questions.filter((question) => question.firstAttemptCorrect).length

    return [{
      ...session,
      startedAt: typeof session.startedAt === 'string'
        ? session.startedAt
        : firstAnsweredAt ?? completedAt,
      completedAt,
      grade: isGrade(session.grade) ? session.grade : fallbackGrade,
      completed: session.completed === true,
      score,
      earnedPoints: isFiniteNumber(session.earnedPoints)
        ? Math.max(0, session.earnedPoints)
        : 0,
    }]
  })
}

function migrateSkillProgress(value: unknown): Record<string, SkillProgress> {
  if (!isRecord(value)) return {}
  const entries = Object.entries(value).flatMap(([key, candidate]) => {
    if (!isRecord(candidate) ||
      !isFiniteNumber(candidate.attempts) || candidate.attempts < 0 ||
      !isFiniteNumber(candidate.correctCount) || candidate.correctCount < 0 ||
      !Array.isArray(candidate.recentResults) ||
      !candidate.recentResults.every((result) => typeof result === 'boolean')) return []

    const attempts = Math.floor(candidate.attempts)
    const recentResults = candidate.recentResults.slice(-10) as boolean[]
    const recentAccuracy = recentResults.length === 0
      ? 0
      : recentResults.filter(Boolean).length / recentResults.length
    const level = isFiniteNumber(candidate.level)
      ? Math.max(1, Math.min(5, Math.floor(candidate.level)))
      : 1
    const skillId = typeof candidate.skillId === 'string' ? candidate.skillId : key

    return [[key, {
      skillId,
      attempts,
      correctCount: Math.min(attempts, Math.floor(candidate.correctCount)),
      recentResults,
      recentAccuracy,
      level,
      lastStudiedAt: typeof candidate.lastStudiedAt === 'string'
        ? candidate.lastStudiedAt
        : null,
    } satisfies SkillProgress] as const]
  })
  return Object.fromEntries(entries)
}

function isStoredQuestion(value: unknown): boolean {
  if (!isRecord(value) ||
    typeof value.id !== 'string' ||
    !isGrade(value.grade) ||
    typeof value.skillId !== 'string' ||
    typeof value.prompt !== 'string' ||
    (typeof value.correctAnswer !== 'number' && typeof value.correctAnswer !== 'string') ||
    typeof value.hint !== 'string' ||
    (value.difficulty !== 1 && value.difficulty !== 2 && value.difficulty !== 3) ||
    !Array.isArray(value.choices) || value.choices.length !== 4) return false

  return value.choices.every((choice) =>
    isRecord(choice) &&
    typeof choice.id === 'string' &&
    typeof choice.label === 'string' &&
    (typeof choice.value === 'number' || typeof choice.value === 'string'))
}

function migrateInProgressSession(value: unknown): InProgressSession | null {
  if (!isRecord(value) ||
    typeof value.sessionId !== 'string' ||
    typeof value.startedAt !== 'string' ||
    !isGrade(value.grade) ||
    !Array.isArray(value.questions) || value.questions.length !== 10 ||
    !value.questions.every(isStoredQuestion) ||
    !Array.isArray(value.results) || value.results.length > value.questions.length ||
    !value.results.every(isQuestionResult)) return null

  const questions = value.questions as InProgressSession['questions']
  const results = value.results as QuestionResult[]
  const matchingPrefix = results.every(
    (result, index) => result.questionId === questions[index].id,
  )
  if (!matchingPrefix) return null

  return {
    ...(value as unknown as InProgressSession),
    questions,
    results,
    // 確定済み結果を信頼し、壊れた問題番号から未回答を飛ばさない。
    currentQuestionIndex: value.results.length,
  }
}

export function migrateAppData(value: unknown): AppData {
  const defaults = createDefaultAppData()
  if (!isStoredAppData(value)) return defaults

  const migrateLearningData = (
    source: Record<string, unknown>,
    fallbackGrade: Grade,
  ): ProfileLearningData => {
    const sessions = migrateSessions(source.sessions, fallbackGrade)
    const storedRewardState = isRecord(source.rewardState)
    ? {
        points: isFiniteNumber(source.rewardState.points)
          ? Math.max(0, source.rewardState.points)
          : 0,
        level: 1,
        unlockedItems: stringArray(source.rewardState.unlockedItems),
      }
    : defaults.rewardState
    const storedTownState = isRecord(source.townState)
    ? { unlockedTownItems: stringArray(source.townState.unlockedTownItems) }
    : defaults.townState
    return {
      skillProgress: migrateSkillProgress(source.skillProgress),
      sessions,
      inProgressSession: migrateInProgressSession(source.inProgressSession),
      rewardState: {
        ...storedRewardState,
        level: calculateRewardLevel(storedRewardState.points),
      },
      townState: updateTownState(
        storedTownState,
        getStudyDateKeys(sessions).length,
      ).townState,
    }
  }

  const settings = isRecord(value.settings)
    ? {
        dailyQuestionCount: isFiniteNumber(value.settings.dailyQuestionCount) &&
          value.settings.dailyQuestionCount > 0
          ? Math.floor(value.settings.dailyQuestionCount)
          : defaults.settings.dailyQuestionCount,
        hintsEnabled: typeof value.settings.hintsEnabled === 'boolean'
          ? value.settings.hintsEnabled
          : defaults.settings.hintsEnabled,
      }
    : defaults.settings

  const storedProfiles = Array.isArray(value.profiles)
    ? value.profiles.map(migrateProfile).filter((item): item is Profile => Boolean(item))
    : []
  const uniqueProfiles = [...new Map(storedProfiles.map((item) => [item.id, item])).values()]
  const legacyProfile = migrateProfile(value.profile)
  const profiles = uniqueProfiles.length > 0
    ? uniqueProfiles
    : legacyProfile ? [legacyProfile] : []

  const profileData: Record<string, ProfileLearningData> = {}
  for (const item of profiles) {
    const storedChild = isRecord(value.profileData) && isRecord(value.profileData[item.id])
      ? value.profileData[item.id]
      : null
    profileData[item.id] = storedChild
      ? migrateLearningData(storedChild as unknown as Record<string, unknown>, item.grade)
      : legacyProfile?.id === item.id
        ? migrateLearningData(value as unknown as Record<string, unknown>, item.grade)
        : createDefaultProfileLearningData()
  }

  const requestedActiveId = typeof value.activeProfileId === 'string'
    ? value.activeProfileId
    : legacyProfile?.id ?? null
  const activeProfileId = profiles.some((item) => item.id === requestedActiveId)
    ? requestedActiveId
    : profiles[0]?.id ?? null
  const profile = profiles.find((item) => item.id === activeProfileId) ?? null
  const legacyLearningData = migrateLearningData(
    value as unknown as Record<string, unknown>,
    legacyProfile?.grade ?? 1,
  )
  const activeData = activeProfileId
    ? profileData[activeProfileId]
    : legacyLearningData

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profiles,
    activeProfileId,
    profileData,
    profile,
    ...activeData,
    settings,
  }
}
