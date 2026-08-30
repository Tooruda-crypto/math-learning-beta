import type { SkillProgress } from '../../types/app'

export type SkillState =
  | 'UNSEEN'
  | 'LEARNING'
  | 'STABLE'
  | 'REVIEW'
  | 'FOCUS'
  | 'MASTERED'

export interface SkillAssessment {
  state: SkillState
  recentAccuracy: number
  lifetimeAccuracy: number
}

const clampAccuracy = (value: number) => Math.min(1, Math.max(0, value))

export function assessSkillProgress(
  progress?: SkillProgress,
): SkillAssessment {
  if (!progress || progress.attempts === 0) {
    return {
      state: 'UNSEEN',
      recentAccuracy: 0,
      lifetimeAccuracy: 0,
    }
  }

  const recentAccuracy = clampAccuracy(progress.recentAccuracy)
  const lifetimeAccuracy = clampAccuracy(
    progress.correctCount / progress.attempts,
  )

  if (progress.attempts < 10) {
    return { state: 'LEARNING', recentAccuracy, lifetimeAccuracy }
  }

  // 直近だけの急な落ち込みでは FOCUS にせず、累計の安定度も確認する。
  if (recentAccuracy < 0.5) {
    return {
      state: lifetimeAccuracy < 0.65 ? 'FOCUS' : 'REVIEW',
      recentAccuracy,
      lifetimeAccuracy,
    }
  }

  if (recentAccuracy < 0.7) {
    return { state: 'REVIEW', recentAccuracy, lifetimeAccuracy }
  }

  const hasFullRecentWindow = progress.recentResults.length >= 10
  const isMastered =
    progress.attempts >= 20 &&
    hasFullRecentWindow &&
    recentAccuracy >= 0.9 &&
    lifetimeAccuracy >= 0.8

  return {
    state: isMastered ? 'MASTERED' : 'STABLE',
    recentAccuracy,
    lifetimeAccuracy,
  }
}
