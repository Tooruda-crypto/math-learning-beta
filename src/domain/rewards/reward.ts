import type { RewardState } from '../../types/app'

export const SESSION_COMPLETION_POINTS = 10

const FIXED_LEVEL_START_POINTS = [0, 50, 100, 200, 350, 550] as const
const EXTENDED_LEVEL_STEP = 250

export function calculateEarnedPoints(firstAttemptCorrectCount: number): number {
  return SESSION_COMPLETION_POINTS + Math.max(0, firstAttemptCorrectCount)
}

export function calculateRewardLevel(points: number): number {
  const safePoints = Math.max(0, points)
  for (let index = 1; index < FIXED_LEVEL_START_POINTS.length; index += 1) {
    if (safePoints < FIXED_LEVEL_START_POINTS[index]) return index
  }
  return 6 + Math.floor((safePoints - FIXED_LEVEL_START_POINTS[5]) / EXTENDED_LEVEL_STEP)
}

export function getRewardLevelStartPoints(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level))
  if (safeLevel <= FIXED_LEVEL_START_POINTS.length) {
    return FIXED_LEVEL_START_POINTS[safeLevel - 1]
  }
  return FIXED_LEVEL_START_POINTS[5] + (safeLevel - 6) * EXTENDED_LEVEL_STEP
}

export function getRewardLevelProgress(points: number) {
  const level = calculateRewardLevel(points)
  const currentLevelStart = getRewardLevelStartPoints(level)
  const nextLevelStart = getRewardLevelStartPoints(level + 1)
  const progress = (Math.max(0, points) - currentLevelStart) /
    (nextLevelStart - currentLevelStart)

  return {
    level,
    nextLevelStart,
    remainingPoints: Math.max(0, nextLevelStart - Math.max(0, points)),
    progress: Math.min(1, Math.max(0, progress)),
  }
}

export function addSessionReward(
  current: RewardState,
  earnedPoints: number,
): RewardState {
  const points = current.points + Math.max(0, earnedPoints)
  return {
    ...current,
    points,
    level: calculateRewardLevel(points),
  }
}
