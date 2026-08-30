import { describe, expect, it } from 'vitest'
import type { SkillProgress } from '../../types/app'
import { assessSkillProgress } from './proficiency'

function progress(
  attempts: number,
  correctCount: number,
  recentResults: boolean[],
): SkillProgress {
  return {
    skillId: 'skill',
    attempts,
    correctCount,
    recentResults,
    recentAccuracy:
      recentResults.filter(Boolean).length / recentResults.length,
    level: 1,
    lastStudiedAt: '2026-08-28T00:00:00.000Z',
  }
}

describe('assessSkillProgress', () => {
  it('未回答をUNSEEN、10問未満をLEARNINGにする', () => {
    expect(assessSkillProgress().state).toBe('UNSEEN')
    expect(assessSkillProgress(progress(9, 7, [true, false])).state).toBe(
      'LEARNING',
    )
  })

  it('直近正答率の境界でFOCUS・REVIEW・STABLEを判定する', () => {
    expect(
      assessSkillProgress(
        progress(10, 4, [true, true, true, true, false, false, false, false, false, false]),
      ).state,
    ).toBe('FOCUS')
    expect(
      assessSkillProgress(
        progress(10, 6, [true, true, true, true, true, true, false, false, false, false]),
      ).state,
    ).toBe('REVIEW')
    expect(
      assessSkillProgress(
        progress(10, 8, [true, true, true, true, true, true, true, true, false, false]),
      ).state,
    ).toBe('STABLE')
  })

  it('MASTEREDには20問・直近10件90%以上・累計80%以上を要求する', () => {
    const nineOfTen = [true, true, true, true, true, true, true, true, true, false]
    expect(assessSkillProgress(progress(20, 18, nineOfTen)).state).toBe(
      'MASTERED',
    )
    expect(assessSkillProgress(progress(19, 18, nineOfTen)).state).toBe(
      'STABLE',
    )
    expect(assessSkillProgress(progress(20, 15, nineOfTen)).state).toBe(
      'STABLE',
    )
  })

  it('直近だけの急落ではFOCUSへ急変させない', () => {
    const recent = [true, true, true, true, false, false, false, false, false, false]
    expect(assessSkillProgress(progress(30, 24, recent)).state).toBe('REVIEW')
  })
})
