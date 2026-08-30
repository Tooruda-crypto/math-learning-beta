import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import { createDailyQuestionPlan } from '../domain/questions/dailyQuestionPlan'
import {
  generateQuestionForProblemType,
  generateQuestionsForSkillPlan,
  getPriority8ProblemTypes,
} from '../domain/questions/generator'
import type {
  LearningQuestion,
  QuestionProblemType,
  QuestionSkillId,
  RandomSource,
} from '../domain/questions/types'
import { IndexedDbAppRepository } from '../storage/IndexedDbAppRepository'
import { createDefaultAppData, migrateAppData } from '../storage/defaultAppData'
import type { InProgressSession, Profile, SkillProgress } from '../types/app'

function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function numbers(prompt: string): number[] {
  return [...prompt.matchAll(/\d+/g)].map((match) => Number(match[0]))
}

function expectFourValidChoices(question: LearningQuestion) {
  const values = question.choices.map((choice) => choice.value)
  expect(values).toHaveLength(4)
  expect(new Set(values).size).toBe(4)
  expect(values.filter((value) => value === question.correctAnswer)).toHaveLength(1)
}

function expectMathematicallyValid(question: LearningQuestion) {
  const type = question.problemType as QuestionProblemType
  const values = numbers(question.prompt)
  switch (type) {
    case 'g1-add-three':
      expect(question.correctAnswer).toBe(values[0] + values[1] + values[2])
      expect(question.correctAnswer).toBeLessThanOrEqual(10)
      return
    case 'g1-mixed-three':
      expect(question.correctAnswer).toBe(values[0] - values[1] + values[2])
      expect(question.correctAnswer).toBeGreaterThanOrEqual(0)
      expect(question.correctAnswer).toBeLessThanOrEqual(10)
      return
    case 'g1-add-missing':
    case 'g1-add-carry-missing':
    case 'g2-add-two-two-missing':
      expect(question.correctAnswer).toBe(values[1] - values[0])
      expect(Number(question.correctAnswer) + values[0]).toBe(values[1])
      return
    case 'g1-sub-missing':
    case 'g1-sub-borrow-missing':
    case 'g2-sub-two-two-missing':
      expect(question.correctAnswer).toBe(values[0] - values[1])
      expect(values[0] - Number(question.correctAnswer)).toBe(values[1])
      return
    case 'g1-compare': {
      const left = values[0] + values[1]
      const right = values[2] + values[3]
      expect(question.correctAnswer).toBe(
        left > right ? 'Aのほうが大きい' : left < right ? 'Bのほうが大きい' : '同じ',
      )
      return
    }
    case 'g1-add-word':
    case 'g2-add-two-two-word':
      expect(question.correctAnswer).toBe(values[0] + values[1])
      return
    case 'g1-sub-word':
    case 'g2-sub-two-two-word':
      expect(question.correctAnswer).toBe(values[0] - values[1])
      expect(question.correctAnswer).toBeGreaterThanOrEqual(0)
      return
    case 'g2-add-two-two':
    case 'g3-add-three':
      expect(question.correctAnswer).toBe(values[0] + values[1])
      expect(question.correctAnswer).toBeLessThanOrEqual(type === 'g2-add-two-two' ? 99 : 999)
      return
    case 'g2-sub-two-two':
    case 'g3-sub-three':
      expect(question.correctAnswer).toBe(values[0] - values[1])
      expect(question.correctAnswer).toBeGreaterThanOrEqual(0)
      return
    case 'g2-multiplication-missing':
      expect(values[0] * Number(question.correctAnswer)).toBe(values[1])
      return
    case 'g2-multiplication-word':
      expect(question.correctAnswer).toBe(values.at(-2)! * values.at(-1)!)
      return
    case 'g3-multiplication-missing':
      expect(Number(question.correctAnswer) * values[0]).toBe(values[1])
      return
    case 'g3-division-missing':
      expect(Number(question.correctAnswer) / values[0]).toBe(values[1])
      return
    case 'g3-division-word':
      expect(values[0] % values[1]).toBe(0)
      expect(question.correctAnswer).toBe(values[0] / values[1])
      return
    case 'g3-division-quotient':
      expect(question.correctAnswer).toBe(Math.floor(values[0] / values[1]))
      expect(values[0] % values[1]).toBeGreaterThan(0)
      return
    case 'g3-division-remainder-only':
      expect(question.correctAnswer).toBe(values[0] % values[1])
      expect(Number(question.correctAnswer)).toBeLessThan(values[1])
      return
    case 'g3-division-remainder-word': {
      const total = values[0]
      const boxSize = values[2]
      const match = String(question.correctAnswer).match(/^(\d+)箱と (\d+)(?:こ|ほん|まい)あまり$/)
      expect(match).not.toBeNull()
      const boxes = Number(match?.[1])
      const remainder = Number(match?.[2])
      expect(boxes * boxSize + remainder).toBe(total)
      expect(remainder).toBeGreaterThan(0)
      expect(remainder).toBeLessThan(boxSize)
      return
    }
    case 'g3-fraction-basic': {
      const denominator = values[1]
      expect(question.correctAnswer).toBe(`1/${denominator}`)
      expect(denominator).toBeGreaterThanOrEqual(2)
      expect(denominator).toBeLessThanOrEqual(6)
      return
    }
    default:
      throw new Error(`Priority 8の検証が未定義です: ${type}`)
  }
}

function progress(skillId: QuestionSkillId): SkillProgress {
  return {
    skillId,
    attempts: 10,
    correctCount: 4,
    recentResults: [true, true, true, true, false, false, false, false, false, false],
    recentAccuracy: 0.4,
    level: 1,
    lastStudiedAt: '2026-08-29T00:00:00.000Z',
  }
}

describe('Priority 8 problem repertoire quality', () => {
  it.each(getPriority8ProblemTypes())('%sをseed固定で100問検査する', (problemType) => {
    const random = seededRandom(getPriority8ProblemTypes().indexOf(problemType) + 8000)
    const prompts = new Set<string>()
    const answerPositions = new Set<number>()
    for (let index = 0; index < 100; index += 1) {
      const question = generateQuestionForProblemType(problemType, random)
      prompts.add(question.prompt)
      answerPositions.add(question.choices.findIndex((choice) => choice.value === question.correctAnswer))
      expect(question.problemType).toBe(problemType)
      expect(question.presentationType).toBeTruthy()
      expect(question.hint.trim().length).toBeGreaterThan(0)
      expectFourValidChoices(question)
      expectMathematicallyValid(question)
    }
    expect(prompts.size).toBeGreaterThanOrEqual(problemType === 'g3-fraction-basic' ? 15 : 10)
    expect(answerPositions.size).toBeGreaterThan(1)
  })

  it('同じスキル内でpresentationTypeを散らし、連続を抑える', () => {
    const questions = generateQuestionsForSkillPlan(
      1,
      Array<QuestionSkillId>(10).fill('g1-add-within-10'),
      seededRandom(81),
    )
    const types = questions.map((question) => question.presentationType)
    expect(new Set(types).size).toBeGreaterThanOrEqual(4)
    expect(types.every((type, index) => index === 0 || type !== types[index - 1])).toBe(true)
  })

  it('FOCUSのスキル配分を維持したまま形式を多様化する', () => {
    const plan = createDailyQuestionPlan(2, {
      'g2-add-two-two': progress('g2-add-two-two'),
    })
    const questions = generateQuestionsForSkillPlan(
      2,
      plan.slots.map((slot) => slot.skillId),
      seededRandom(82),
    )
    expect(questions.map((question) => question.skillId)).toEqual(
      plan.slots.map((slot) => slot.skillId),
    )
    expect(plan.slots.filter((slot) => slot.kind === 'weakness')).toHaveLength(3)
    expect(new Set(questions.map((question) => question.presentationType)).size).toBeGreaterThan(1)
  })
})

describe('Priority 8 persistence compatibility', () => {
  const profile: Profile = {
    id: 'priority8-profile',
    nickname: 'そら',
    grade: 3,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  }

  it('新しい文章題を途中保存し、再読込しても形式を保持する', async () => {
    const indexedDb = new IDBFactory()
    const repository = new IndexedDbAppRepository(indexedDb)
    await repository.saveProfile(profile)
    const question = generateQuestionForProblemType('g3-division-remainder-word', seededRandom(83))
    const session: InProgressSession = {
      sessionId: 'priority8-session',
      startedAt: '2026-08-29T00:01:00.000Z',
      grade: 3,
      questions: Array.from({ length: 10 }, (_, index) => ({ ...question, id: `${question.id}-${index}` })),
      currentQuestionIndex: 0,
      results: [],
    }
    await repository.saveInProgressSession(session)
    const reloaded = await new IndexedDbAppRepository(indexedDb).getAppData()
    expect(reloaded.schemaVersion).toBe(4)
    expect(reloaded.inProgressSession?.questions[0]).toMatchObject({
      presentationType: 'word-problem',
      prompt: question.prompt,
      correctAnswer: question.correctAnswer,
    })
  })

  it('presentationTypeがない既存schemaVersion 4途中問題も破棄せず読める', () => {
    const defaults = createDefaultAppData()
    const legacyQuestion = {
      id: 'legacy-question', grade: 1 as const, skillId: 'g1-add-within-10',
      prompt: '1 + 2 = ?', correctAnswer: 3,
      choices: [1, 2, 3, 4].map((value) => ({ id: String(value), label: String(value), value })),
      hint: '1から2こ先を数えてみよう。', difficulty: 1 as const,
    }
    const migrated = migrateAppData({
      ...defaults,
      profiles: [profile],
      activeProfileId: profile.id,
      profileData: {
        [profile.id]: {
          skillProgress: {}, sessions: [], rewardState: defaults.rewardState,
          townState: defaults.townState,
          inProgressSession: {
            sessionId: 'legacy-session', startedAt: '', grade: 1,
            questions: Array.from({ length: 10 }, (_, index) => ({ ...legacyQuestion, id: `${legacyQuestion.id}-${index}` })),
            currentQuestionIndex: 0, results: [],
          },
        },
      },
    })
    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.inProgressSession?.questions[0].prompt).toBe('1 + 2 = ?')
    expect(migrated.inProgressSession?.questions[0].presentationType).toBeUndefined()
  })
})

describe('Priority 8 development preview', () => {
  it('開発時だけ指定した新形式を実画面で確認できる', async () => {
    const previousUrl = window.location.href
    window.history.replaceState({}, '', '/?previewProblem=g3-fraction-basic')
    const repository = new IndexedDbAppRepository(new IDBFactory())
    render(<App repository={repository} />)
    expect(await screen.findByText('1つ分は？', { exact: false })).toBeVisible()
    expect(screen.getByRole('group', { name: '答えを選ぶ' })).toBeVisible()
    window.history.replaceState({}, '', previousUrl)
  })
})
