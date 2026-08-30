import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { IndexedDbAppRepository } from '../../storage/IndexedDbAppRepository'
import type { SkillProgress } from '../../types/app'
import { SKILL_SEQUENCE_BY_GRADE } from '../skills/learningPath'
import {
  createDailyQuestionPlan,
  createPersonalizedQuestionSession,
} from './dailyQuestionPlan'
import type { QuestionSkillId, RandomSource } from './types'

function progress(
  skillId: QuestionSkillId,
  attempts: number,
  correctCount: number,
  recentResults: boolean[],
): SkillProgress {
  return {
    skillId,
    attempts,
    correctCount,
    recentResults,
    recentAccuracy:
      recentResults.filter(Boolean).length / recentResults.length,
    level: 1,
    lastStudiedAt: '2026-08-28T00:00:00.000Z',
  }
}

function seededRandom(seed = 42): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function maxConsecutiveSkillIds(skillIds: QuestionSkillId[]): number {
  let maximum = 0
  let current = 0
  let previous: QuestionSkillId | undefined
  for (const skillId of skillIds) {
    current = skillId === previous ? current + 1 : 1
    maximum = Math.max(maximum, current)
    previous = skillId
  }
  return maximum
}

function maximumSkillCount(skillIds: QuestionSkillId[]): number {
  const counts = new Map<QuestionSkillId, number>()
  for (const skillId of skillIds) {
    counts.set(skillId, (counts.get(skillId) ?? 0) + 1)
  }
  return Math.max(...counts.values())
}

describe('DailyQuestionPlan', () => {
  it('学年別の既存スキル順序を定義する', () => {
    expect(SKILL_SEQUENCE_BY_GRADE[1]).toEqual([
      'g1-add-within-10',
      'g1-sub-within-10',
      'g1-add-with-carry',
      'g1-sub-with-borrow',
    ])
    expect(SKILL_SEQUENCE_BY_GRADE[2]).toEqual([
      'g2-add-two-one',
      'g2-sub-two-one',
      'g2-add-two-two',
      'g2-sub-two-two',
      'g2-multiplication-2-5',
      'g2-multiplication-6-9',
    ])
    expect(SKILL_SEQUENCE_BY_GRADE[3]).toEqual([
      'g3-add-three',
      'g3-sub-three',
      'g3-multiply-two-one',
      'g3-division-exact',
      'g3-division-remainder',
      'g3-fraction-basic',
    ])
  })

  it.each([1, 2, 3] as const)('履歴なしの小学%s年で偏りを抑えた10問計画を作る', (grade) => {
    const plan = createDailyQuestionPlan(grade, {})
    const skillIds = plan.slots.map((slot) => slot.skillId)

    expect(plan.slots).toHaveLength(10)
    expect(plan.slots.filter((slot) => slot.kind === 'challenge')).toHaveLength(1)
    expect(maximumSkillCount(skillIds)).toBeLessThanOrEqual(6)
    expect(maxConsecutiveSkillIds(skillIds)).toBeLessThanOrEqual(2)
  })

  it('苦手があっても苦手枠を3問に抑え、他の内容を混ぜる', () => {
    const focusRecent = [true, true, true, true, false, false, false, false, false, false]
    const learningRecent = [true, false]
    const savedProgress = {
      'g1-add-within-10': progress('g1-add-within-10', 10, 4, focusRecent),
      'g1-sub-within-10': progress('g1-sub-within-10', 10, 4, focusRecent),
      'g1-add-with-carry': progress('g1-add-with-carry', 2, 1, learningRecent),
    }
    const plan = createDailyQuestionPlan(1, savedProgress)
    const weaknessSlots = plan.slots.filter((slot) => slot.kind === 'weakness')
    const weakSkillIds = new Set([
      'g1-add-within-10',
      'g1-sub-within-10',
    ])

    expect(weaknessSlots).toHaveLength(3)
    expect(weaknessSlots.length).toBeLessThanOrEqual(4)
    expect(plan.slots.some((slot) => !weakSkillIds.has(slot.skillId))).toBe(true)
    expect(maxConsecutiveSkillIds(plan.slots.map((slot) => slot.skillId))).toBeLessThanOrEqual(2)
  })

  it('STABLEになったスキルの次をチャレンジ枠へ混ぜる', () => {
    const stable = [true, true, true, true, true, true, true, true, false, false]
    const plan = createDailyQuestionPlan(1, {
      'g1-add-within-10': progress('g1-add-within-10', 10, 8, stable),
    })

    expect(plan.currentSkillId).toBe('g1-add-within-10')
    expect(plan.challengeSkillId).toBe('g1-sub-within-10')
    expect(plan.slots).toContainEqual({
      kind: 'challenge',
      skillId: 'g1-sub-within-10',
    })
  })

  it('MASTEREDになったら次のスキルを現在学習中へ進める', () => {
    const mastered = [true, true, true, true, true, true, true, true, true, false]
    const plan = createDailyQuestionPlan(1, {
      'g1-add-within-10': progress('g1-add-within-10', 20, 18, mastered),
    })

    expect(plan.assessments['g1-add-within-10']?.state).toBe('MASTERED')
    expect(plan.currentSkillId).toBe('g1-sub-within-10')
  })

  it('計画をProblem Generatorへ渡して重複なしの10問を作る', () => {
    const session = createPersonalizedQuestionSession(2, {}, seededRandom())

    expect(session.questions).toHaveLength(10)
    expect(new Set(session.questions.map((question) => question.prompt)).size).toBe(10)
    expect(session.questions.map((question) => question.skillId)).toEqual(
      session.plan.slots.map((slot) => slot.skillId),
    )
  })

  it('Repositoryから再読込したPriority 2データを次回計画へ反映する', async () => {
    const repository = new IndexedDbAppRepository(new IDBFactory())
    await repository.saveProfile({
      id: 'profile-plan', nickname: 'テスト', grade: 2,
      createdAt: '', updatedAt: '',
    })
    const focusRecent = [true, true, true, true, false, false, false, false, false, false]
    await repository.saveSkillProgress(
      progress('g2-add-two-one', 10, 4, focusRecent),
    )

    const reloaded = await repository.getAppData()
    const plan = createDailyQuestionPlan(2, reloaded.skillProgress)

    expect(plan.assessments['g2-add-two-one']?.state).toBe('FOCUS')
    expect(
      plan.slots.some(
        (slot) =>
          slot.kind === 'weakness' && slot.skillId === 'g2-add-two-one',
      ),
    ).toBe(true)
  })
})
