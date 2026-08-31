import { render, screen } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createDailyQuestionPlan, createPersonalizedQuestionSession } from '../domain/questions/dailyQuestionPlan'
import {
  generateQuestion,
  generateQuestionForProblemType,
  getPriority9ProblemTypes,
} from '../domain/questions/generator'
import { addMinutes, PRIORITY_9_SKILL_IDS } from '../domain/questions/priority9'
import type {
  LearningQuestion,
  QuestionProblemType,
  RandomSource,
} from '../domain/questions/types'
import { SKILL_SEQUENCE_BY_GRADE } from '../domain/skills/learningPath'
import { QuestionPage } from '../pages/QuestionPage'
import { IndexedDbAppRepository } from '../storage/IndexedDbAppRepository'
import type { SkillProgress } from '../types/app'

function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function expectQuestionQuality(question: LearningQuestion) {
  expect(question.choices).toHaveLength(4)
  expect(new Set(question.choices.map((choice) => choice.value)).size).toBe(4)
  expect(question.choices.some((choice) => choice.value === question.correctAnswer)).toBe(true)
  expect(question.prompt).not.toMatch(/-\d/)
  expect(question.hint.length).toBeGreaterThan(5)
  expect(question.hint).not.toBe(String(question.correctAnswer))
  expect(question.skillId.startsWith(`g${question.grade}-`)).toBe(true)
}

function numbers(prompt: string): number[] {
  return [...prompt.matchAll(/\d+/g)].map((match) => Number(match[0]))
}

function expectWordMath(question: LearningQuestion) {
  const values = numbers(question.prompt)
  if (question.problemType === 'g1-add-word-varied') {
    expect(question.correctAnswer).toBe(values[0] + values[1])
  }
  if (question.problemType === 'g1-sub-word-varied') {
    expect(question.correctAnswer).toBe(
      question.prompt.includes('はじめに')
        ? values[0] + values[1]
        : values[0] - values[1],
    )
  }
  if (question.problemType === 'g2-multiplication-word-varied') {
    expect(question.correctAnswer).toBe(values.at(-2)! * values.at(-1)!)
  }
  if (
    question.problemType === 'g3-division-word-varied' &&
    typeof question.correctAnswer === 'number'
  ) {
    const divisor = Number(
      question.prompt.match(/(?:1箱に|1人に)\s*(\d+)/)?.[1] ?? values[1],
    )
    expect(Number.isInteger(values[0] / divisor)).toBe(true)
    expect(question.correctAnswer).toBe(values[0] / divisor)
  }
}

describe('Priority 9 問題生成品質', () => {
  const priority9Types = getPriority9ProblemTypes()

  it('16系統を公開対象として定義する', () => {
    expect(priority9Types).toHaveLength(16)
    expect(new Set(priority9Types).size).toBe(16)
  })

  it.each(priority9Types)('%sを100問生成して品質を保つ', (problemType) => {
    const random = seededRandom(priority9Types.indexOf(problemType) + 901)
    const generated = Array.from({ length: 100 }, () =>
      generateQuestionForProblemType(problemType, random),
    )

    for (const question of generated) {
      expectQuestionQuality(question)
      expectWordMath(question)
      expect(question.grade).toBe(Number(problemType[1]))
    }

    if (problemType.endsWith('-time')) {
      expect(generated.every((question) => question.presentationType === 'clock')).toBe(true)
    }
    if (problemType.endsWith('-length')) {
      expect(generated.every((question) => question.presentationType === 'measurement')).toBe(true)
    }
    if (problemType.endsWith('-money')) {
      expect(generated.every((question) => question.presentationType === 'money')).toBe(true)
      expect(generated.every((question) => String(question.correctAnswer).endsWith('円'))).toBe(true)
    }
    if (problemType.endsWith('-number-concept')) {
      expect(generated.every((question) => question.presentationType === 'number-concept')).toBe(true)
      const maximum = Number(problemType[1]) === 1 ? 99 : Number(problemType[1]) === 2 ? 999 : 9999
      expect(generated.every((question) =>
        typeof question.correctAnswer !== 'number' || question.correctAnswer <= maximum,
      )).toBe(true)
      const prompts = generated.map((question) => question.prompt).join('\n')
      expect(prompts).toContain('つぎの数')
      expect(prompts).toContain('まえの数')
      expect(prompts).toContain('くらいごと')
      expect(prompts).toContain('どちらの数が大きい')
      expect(prompts).toContain('数直線')
    }
  })

  it('あまりのある文章題を100問生成し、あまりを除数未満にする', () => {
    const random = seededRandom(9901)
    for (let index = 0; index < 100; index += 1) {
      const question = generateQuestion(
        3,
        'g3-division-remainder',
        random,
        'g3-division-word-varied',
      )
      expectQuestionQuality(question)
      const values = numbers(question.prompt)
      const divisor = Number(
        question.prompt.match(/(?:1箱に|1人に)\s*(\d+)/)?.[1] ?? values[1],
      )
      if (typeof question.correctAnswer === 'number') {
        expect(question.correctAnswer).toBe(values[0] % divisor)
        expect(question.correctAnswer).toBeLessThan(divisor)
      } else {
        const remainder = Number(String(question.correctAnswer).match(/ (\d+)[^\d]*あまり/)?.[1])
        expect(remainder).toBe(values[0] % divisor)
        expect(remainder).toBeLessThan(divisor)
      }
    }
  })

  it('文章題21意味系統をテンプレート上で使い分ける', () => {
    const samples = (problemType: QuestionProblemType, count: number, seed: number) => {
      const random = seededRandom(seed)
      return Array.from({ length: count }, () =>
        generateQuestionForProblemType(problemType, random).prompt,
      ).join('\n')
    }
    const addition = samples('g1-add-word-varied', 100, 1101)
    expect(addition).toContain('あわせて')
    expect(addition).toContain('あとから')
    expect(addition).toContain('もらいました')
    expect(addition).toContain('1つに あつめる')

    const subtraction = samples('g1-sub-word-varied', 100, 1102)
    expect(subtraction).toContain('のこり')
    expect(subtraction).toContain('おりました')
    expect(subtraction).toContain('ちがい')
    expect(subtraction).toContain('おおい')
    expect(subtraction).toContain('はじめに')

    const multiplication = samples('g2-multiplication-word-varied', 100, 1103)
    for (const marker of ['グループ', 'くばります', 'さら', 'ふくろ', 'れつ', '円の']) {
      expect(multiplication).toContain(marker)
    }

    const exactRandom = seededRandom(1104)
    const remainderRandom = seededRandom(1105)
    const division = [
      ...Array.from({ length: 100 }, () => generateQuestionForProblemType('g3-division-word-varied', exactRandom).prompt),
      ...Array.from({ length: 100 }, () => generateQuestion(3, 'g3-division-remainder', remainderRandom, 'g3-division-word-varied').prompt),
    ].join('\n')
    for (const marker of ['1人分', '何人', '何グループ', '何箱', 'あまり']) {
      expect(division).toContain(marker)
    }
  })

  it('60分・12時・午前午後の境界を循環計算する', () => {
    expect(addMinutes(11 * 60 + 30, 30)).toBe(12 * 60)
    expect(addMinutes(11 * 60 + 45, 30)).toBe(12 * 60 + 15)
    expect(addMinutes(23 * 60 + 30, 60)).toBe(30)
    expect(addMinutes(0, -30)).toBe(23 * 60 + 30)
  })

  it('長さとお金の単位境界を学年内の値で生成する', () => {
    const oneMeter = generateQuestionForProblemType('g2-length', () => 0.99)
    expect(oneMeter.prompt).toContain('1m')
    expect(oneMeter.correctAnswer).toBe('100cm')

    const oneKilometer = generateQuestionForProblemType('g3-length', () => 0)
    expect(oneKilometer.prompt).toContain('1km')
    expect(oneKilometer.correctAnswer).toBe('1000m')

    const gradeOneCoins = generateQuestionForProblemType('g1-money', () => 0)
    expect(gradeOneCoins.correctAnswer).toBe('10円')

    const gradeTwoTotal = generateQuestionForProblemType('g2-money', () => 0)
    expect(gradeTwoTotal.correctAnswer).toBe('50円')

    const gradeThreeShopping = generateQuestionForProblemType('g3-money', () => 0)
    expect(gradeThreeShopping.correctAnswer).toBe('500円')
  })

  it.each([1, 2, 3] as const)('小学%s年の新Skillを学年内だけに定義する', (grade) => {
    const sequence = SKILL_SEQUENCE_BY_GRADE[grade]
    const newSkills = sequence.filter((skillId) => PRIORITY_9_SKILL_IDS.includes(skillId as never))
    expect(newSkills).toHaveLength(4)
    expect(newSkills.every((skillId) => skillId.startsWith(`g${grade}-`))).toBe(true)
  })

  it('既存Skill習得後も新領域を1日5問以下に抑える', () => {
    const mastered = [true, true, true, true, true, true, true, true, true, false]
    const progress = Object.fromEntries(
      SKILL_SEQUENCE_BY_GRADE[1].slice(0, 4).map((skillId) => [skillId, {
        skillId,
        attempts: 20,
        correctCount: 18,
        recentResults: mastered,
        recentAccuracy: 0.9,
        level: 1,
        lastStudiedAt: '2026-08-30T00:00:00.000Z',
      } satisfies SkillProgress]),
    )

    const plan = createDailyQuestionPlan(1, progress)
    const newAreaCount = plan.slots.filter((slot) =>
      PRIORITY_9_SKILL_IDS.includes(slot.skillId as never),
    ).length

    expect(plan.currentSkillId).toBe('g1-number-concept')
    expect(newAreaCount).toBeLessThanOrEqual(5)
    expect(plan.slots.some((slot) => !PRIORITY_9_SKILL_IDS.includes(slot.skillId as never))).toBe(true)
  })

  it.each([1, 2, 3] as const)('既存履歴がある小学%s年で学年内の10問を生成する', (grade) => {
    const mastered = [true, true, true, true, true, true, true, true, true, false]
    const progress = Object.fromEntries(
      SKILL_SEQUENCE_BY_GRADE[grade].slice(0, -4).map((skillId) => [skillId, {
        skillId,
        attempts: 20,
        correctCount: 18,
        recentResults: mastered,
        recentAccuracy: 0.9,
        level: 1,
        lastStudiedAt: '2026-08-30T00:00:00.000Z',
      } satisfies SkillProgress]),
    )
    const session = createPersonalizedQuestionSession(grade, progress, seededRandom(1200 + grade))
    expect(session.questions).toHaveLength(10)
    expect(session.questions.every((question) => question.grade === grade)).toBe(true)
    expect(new Set(session.questions.map((question) => question.id)).size).toBe(10)
  })

  it('アナログ時計を自作SVGで表示し、回答操作を維持する', () => {
    const question = generateQuestionForProblemType('g1-time', () => 0)
    render(
      <QuestionPage
        questions={Array.from({ length: 10 }, (_, index) => ({
          ...question,
          id: `${question.id}-${index}`,
        }))}
        onComplete={() => undefined}
      />,
    )

    expect(screen.getByRole('img', { name: /時計/ })).toBeVisible()
    expect(screen.getByRole('group', { name: '答えを選ぶ' }).querySelectorAll('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: '答えを決める' })).toBeDisabled()
  })

  it('schemaVersion 4のまま時計の途中問題をIndexedDBへ保持する', async () => {
    const repository = new IndexedDbAppRepository(new IDBFactory())
    await repository.saveProfile({
      id: 'p9-profile', nickname: 'テスト', grade: 1,
      createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z',
    })
    const question = generateQuestionForProblemType('g1-time', () => 0)
    await repository.saveInProgressSession({
      sessionId: 'p9-session',
      startedAt: '2026-08-31T00:00:00.000Z',
      grade: 1,
      questions: Array.from({ length: 10 }, (_, index) => ({
        ...question,
        id: `${question.id}-${index}`,
      })),
      currentQuestionIndex: 0,
      results: [],
    })
    const reloaded = await repository.getAppData()
    expect(reloaded.schemaVersion).toBe(4)
    expect(reloaded.inProgressSession?.questions[0].visual).toEqual(question.visual)
  })
})
