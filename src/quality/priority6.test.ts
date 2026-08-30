import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createDailyQuestionPlan } from '../domain/questions/dailyQuestionPlan'
import { generateQuestion, getGradeSkillIds } from '../domain/questions/generator'
import type {
  LearningQuestion,
  QuestionProblemType,
  QuestionSkillId,
  RandomSource,
} from '../domain/questions/types'
import { calculateEarnedPoints } from '../domain/rewards/reward'
import { assessSkillProgress } from '../domain/skills/proficiency'
import { TOWN_ITEMS, updateTownState } from '../domain/town/town'
import { IndexedDbAppRepository } from '../storage/IndexedDbAppRepository'
import { migrateAppData } from '../storage/defaultAppData'
import type {
  DailySession,
  Grade,
  InProgressSession,
  QuestionResult,
  SkillProgress,
} from '../types/app'

function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function parse(question: LearningQuestion) {
  const match = question.prompt.match(/^(\d+) ([+−×÷]) (\d+) = \?$/)
  if (!match) throw new Error(`Unexpected prompt: ${question.prompt}`)
  return { left: Number(match[1]), operator: match[2], right: Number(match[3]) }
}

function expectedAnswer(question: LearningQuestion): number | string {
  const { left, operator, right } = parse(question)
  if (operator === '+') return left + right
  if (operator === '−') return left - right
  if (operator === '×') return left * right
  const quotient = Math.floor(left / right)
  const remainder = left % right
  return remainder === 0 ? quotient : `${quotient} あまり ${remainder}`
}

const PRIORITY_6_SKILLS_BY_GRADE: Record<Grade, QuestionSkillId[]> = {
  1: ['g1-add-within-10', 'g1-sub-within-10', 'g1-add-with-carry', 'g1-sub-with-borrow'],
  2: ['g2-add-two-one', 'g2-sub-two-one', 'g2-multiplication-2-5', 'g2-multiplication-6-9'],
  3: ['g3-multiply-two-one', 'g3-division-exact', 'g3-division-remainder'],
}

const PRIORITY_6_PROBLEM_TYPE: Partial<Record<QuestionSkillId, QuestionProblemType>> = {
  'g1-add-within-10': 'g1-add-basic',
  'g1-sub-within-10': 'g1-sub-basic',
  'g1-add-with-carry': 'g1-add-carry',
  'g1-sub-with-borrow': 'g1-sub-borrow',
  'g2-add-two-one': 'g2-add-two-one',
  'g2-sub-two-one': 'g2-sub-two-one',
  'g2-multiplication-2-5': 'g2-multiplication',
  'g2-multiplication-6-9': 'g2-multiplication',
  'g3-multiply-two-one': 'g3-multiply-two-one',
  'g3-division-exact': 'g3-division-exact',
  'g3-division-remainder': 'g3-division-remainder',
}

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
    recentAccuracy: recentResults.length === 0
      ? 0
      : recentResults.filter(Boolean).length / recentResults.length,
    level: 1,
    lastStudiedAt: '2026-08-29T00:00:00.000Z',
  }
}

function questionResult(index: number): QuestionResult {
  return {
    questionId: `q-${index}`,
    skillId: 'g1-add-within-10',
    question: '1 + 1 = ?',
    correctAnswer: '2',
    selectedAnswer: '2',
    firstAttemptCorrect: true,
    retryCorrect: null,
    responseTimeMs: 100,
    answeredAt: `2026-08-29T00:${String(index).padStart(2, '0')}:00.000Z`,
  }
}

function inProgress(resultCount: number): InProgressSession {
  return {
    sessionId: `resume-${resultCount}`,
    startedAt: '2026-08-29T00:00:00.000Z',
    grade: 1,
    questions: Array.from({ length: 10 }, (_, index) => ({
      id: `q-${index}`,
      grade: 1 as const,
      skillId: 'g1-add-within-10',
      prompt: `${index % 6} + 1 = ?`,
      correctAnswer: (index % 6) + 1,
      choices: [0, 1, 2, 3].map((offset) => ({
        id: `${index}-${offset}`,
        label: String((index % 6) + offset),
        value: (index % 6) + offset,
      })),
      hint: '1こ先を数えてみよう。',
      difficulty: 1 as const,
    })),
    currentQuestionIndex: resultCount,
    results: Array.from({ length: resultCount }, (_, index) => questionResult(index)),
  }
}

describe('Priority 6 question quality', () => {
  it.each([1, 2, 3] as Grade[])('小学%s年の全単元を各100問検査する', (grade) => {
    for (const [skillIndex, skillId] of PRIORITY_6_SKILLS_BY_GRADE[grade].entries()) {
      const random = seededRandom(grade * 1000 + skillIndex)
      const prompts = new Set<string>()
      for (let index = 0; index < 100; index += 1) {
        const question = generateQuestion(
          grade,
          skillId,
          random,
          PRIORITY_6_PROBLEM_TYPE[skillId],
        )
        const { left, right } = parse(question)
        const values = question.choices.map((choice) => choice.value)
        prompts.add(question.prompt)

        expect(question.grade).toBe(grade)
        expect(question.correctAnswer).toBe(expectedAnswer(question))
        expect(values).toHaveLength(4)
        expect(new Set(values).size).toBe(4)
        expect(values).toContain(question.correctAnswer)
        expect(left).toBeGreaterThanOrEqual(0)
        expect(right).toBeGreaterThanOrEqual(0)
        expect(question.hint.trim().length).toBeGreaterThan(0)

        if (skillId === 'g1-add-within-10') expect(left + right).toBeLessThanOrEqual(10)
        if (skillId === 'g1-sub-within-10') expect(left - right).toBeGreaterThanOrEqual(0)
        if (skillId === 'g1-add-with-carry') {
          expect(left + right).toBeGreaterThanOrEqual(10)
          expect(left + right).toBeLessThanOrEqual(18)
          expect(question.hint).toContain(`${10 - left}`)
        }
        if (skillId === 'g1-sub-with-borrow') expect(left % 10).toBeLessThan(right)
        if (skillId === 'g3-division-exact') expect(left % right).toBe(0)
        if (skillId === 'g3-division-remainder') {
          expect(left % right).toBeGreaterThan(0)
          expect(left % right).toBeLessThan(right)
          expect(question.hint).toContain(`${right * Math.floor(left / right)}`)
        }
      }
      expect(prompts.size).toBeGreaterThanOrEqual(10)
    }
  })
})

describe('Priority 6 personalization', () => {
  it('全状態を判定し、学年外スキルや苦手だけの計画を作らない', () => {
    const focus = progress('g2-add-two-one', 10, 4, [true, true, true, true, false, false, false, false, false, false])
    const review = progress('g2-sub-two-one', 10, 6, [true, true, true, true, true, true, false, false, false, false])
    const stable = progress('g2-multiplication-2-5', 10, 8, [true, true, true, true, true, true, true, true, false, false])
    const mastered = progress('g2-multiplication-6-9', 20, 18, [true, true, true, true, true, true, true, true, true, false])
    const saved = {
      [focus.skillId]: focus,
      [review.skillId]: review,
      [stable.skillId]: stable,
      [mastered.skillId]: mastered,
      'g3-division-exact': progress('g3-division-exact', 20, 20, Array(10).fill(true)),
    }
    expect(assessSkillProgress().state).toBe('UNSEEN')
    expect(assessSkillProgress(progress('g2-add-two-one', 9, 8, [true])).state).toBe('LEARNING')
    expect(assessSkillProgress(focus).state).toBe('FOCUS')
    expect(assessSkillProgress(review).state).toBe('REVIEW')
    expect(assessSkillProgress(stable).state).toBe('STABLE')
    expect(assessSkillProgress(mastered).state).toBe('MASTERED')

    const plan = createDailyQuestionPlan(2, saved)
    const gradeSkills = new Set(getGradeSkillIds(2))
    expect(plan.slots).toHaveLength(10)
    expect(plan.slots.every((slot) => gradeSkills.has(slot.skillId))).toBe(true)
    expect(plan.slots.filter((slot) => slot.kind === 'weakness').length).toBeLessThanOrEqual(4)
    expect(plan.slots.some((slot) => slot.kind !== 'weakness')).toBe(true)
    expect(plan.slots.every((slot, index) =>
      index === 0 || slot.skillId !== plan.slots[index - 1].skillId)).toBe(true)
  })
})

describe('Priority 6 resume and data safety', () => {
  it.each([1, 3, 9])('%i問完了時点を再読込しても学習実績へ反映しない', async (resultCount) => {
    const indexedDb = new IDBFactory()
    const seedRepository = new IndexedDbAppRepository(indexedDb)
    await seedRepository.saveProfile({
      id: 'resume-profile', nickname: 'テスト', grade: 1,
      createdAt: '', updatedAt: '',
    })
    await seedRepository.saveInProgressSession(inProgress(resultCount))
    const reloaded = await new IndexedDbAppRepository(indexedDb).getAppData()
    expect(reloaded.inProgressSession?.currentQuestionIndex).toBe(resultCount)
    expect(reloaded.inProgressSession?.results).toHaveLength(resultCount)
    expect(reloaded.sessions).toEqual([])
    expect(reloaded.skillProgress).toEqual({})
    expect(reloaded.rewardState.points).toBe(0)
    expect(reloaded.townState.unlockedTownItems).toEqual([])
  })

  it('壊れた途中位置を回答数へ戻し、不整合な途中データは破棄する', () => {
    const recoverable = migrateAppData({
      schemaVersion: 3,
      profile: {
        id: 'legacy', nickname: 'そら', grade: 1,
        createdAt: '', updatedAt: '',
      },
      inProgressSession: { ...inProgress(3), currentQuestionIndex: 9 },
    })
    expect(recoverable.inProgressSession?.currentQuestionIndex).toBe(3)

    const inconsistent = inProgress(3)
    inconsistent.results[1] = { ...inconsistent.results[1], questionId: '別の問題' }
    expect(migrateAppData({
      schemaVersion: 3,
      profile: {
        id: 'legacy', nickname: 'そら', grade: 1,
        createdAt: '', updatedAt: '',
      },
      inProgressSession: inconsistent,
    }).inProgressSession).toBeNull()
  })

  it('部分的に壊れたVersion 3データから安全な既定値へ復旧する', () => {
    const migrated = migrateAppData({
      schemaVersion: 3,
      profile: { id: 'bad', nickname: '', grade: 9 },
      sessions: [null, { id: 'broken' }],
      skillProgress: { bad: { attempts: 'many' } },
      rewardState: { points: Number.NaN, unlockedItems: [1, 'starter'] },
      townState: { unlockedTownItems: ['tree', 2] },
      settings: { dailyQuestionCount: -1, hintsEnabled: 'yes' },
    })
    expect(migrated).toMatchObject({
      schemaVersion: 4,
      profile: null,
      sessions: [],
      skillProgress: {},
      rewardState: { points: 0, level: 1, unlockedItems: ['starter'] },
      townState: { unlockedTownItems: ['tree'] },
      settings: { dailyQuestionCount: 10, hintsEnabled: true },
    })
  })
})

describe('Priority 6 rewards and town boundaries', () => {
  it('初回正解0問で10、10問で20ポイントにする', () => {
    expect(calculateEarnedPoints(0)).toBe(10)
    expect(calculateEarnedPoints(10)).toBe(20)
  })

  it.each(TOWN_ITEMS.map((item) => [item.id, item.requiredStudyDays] as const))(
    '%sの解放日前日・当日・翌日を判定する',
    (itemId, requiredStudyDays) => {
      expect(updateTownState({ unlockedTownItems: [] }, Math.max(0, requiredStudyDays - 1))
        .townState.unlockedTownItems).not.toContain(itemId)
      expect(updateTownState({ unlockedTownItems: [] }, requiredStudyDays)
        .townState.unlockedTownItems).toContain(itemId)
      expect(updateTownState({ unlockedTownItems: [] }, requiredStudyDays + 1)
        .townState.unlockedTownItems).toContain(itemId)
    },
  )
})

describe('Priority 6 atomic repository failure', () => {
  it('集約保存が途中で失敗しても5種類のデータを部分更新しない', async () => {
    const indexedDb = new IDBFactory()
    const repository = new IndexedDbAppRepository(indexedDb)
    await repository.saveProfile({
      id: 'atomic-profile', nickname: 'テスト', grade: 1,
      createdAt: '', updatedAt: '',
    })
    const pending = inProgress(1)
    await repository.saveInProgressSession(pending)
    const before = await repository.getAppData()
    const session: DailySession = {
      id: pending.sessionId,
      date: '2026-08-29',
      startedAt: pending.startedAt,
      completedAt: '2026-08-29T00:10:00.000Z',
      grade: 1,
      questions: Array.from({ length: 10 }, (_, index) => questionResult(index)),
      completed: true,
      score: 10,
      earnedPoints: 20,
    }
    const nonCloneableReward = {
      points: 20,
      level: 1,
      unlockedItems: [(() => undefined) as unknown as string],
    }

    await expect(repository.saveCompletedSession(
      session,
      [progress('g1-add-within-10', 10, 10, Array(10).fill(true))],
      nonCloneableReward,
      { unlockedTownItems: ['tree'] },
    )).rejects.toMatchObject({ name: 'AppRepositoryError' })

    const after = await repository.getAppData()
    expect(after.sessions).toEqual(before.sessions)
    expect(after.skillProgress).toEqual(before.skillProgress)
    expect(after.rewardState).toEqual(before.rewardState)
    expect(after.townState).toEqual(before.townState)
    expect(after.inProgressSession).toEqual(before.inProgressSession)
  })

  it.each([
    'saveSession',
    'saveSkillProgress',
    'saveRewardState',
    'saveTownState',
    'saveInProgressSession',
  ] as const)('%sの保存失敗を握りつぶさない', async (operation) => {
    const broken = { open: () => { throw new Error('unavailable') } } as unknown as IDBFactory
    const repository = new IndexedDbAppRepository(broken)
    const calls = {
      saveSession: () => repository.saveSession({
        id: 's', date: '2026-08-29', startedAt: '', completedAt: '', grade: 1,
        questions: [], completed: true, score: 0, earnedPoints: 10,
      }),
      saveSkillProgress: () => repository.saveSkillProgress(progress('g1-add-within-10', 1, 1, [true])),
      saveRewardState: () => repository.saveRewardState({ points: 10, level: 1, unlockedItems: [] }),
      saveTownState: () => repository.saveTownState({ unlockedTownItems: ['tree'] }),
      saveInProgressSession: () => repository.saveInProgressSession(inProgress(1)),
    }
    await expect(calls[operation]()).rejects.toMatchObject({
      name: 'AppRepositoryError',
      operation,
    })
  })
})
