import { describe, expect, it } from 'vitest'
import { generateQuestion, generateQuestionSession, getGradeSkillIds } from './generator'
import type { LearningQuestion, QuestionProblemType, QuestionSkillId, RandomSource } from './types'
import type { Grade } from '../../types/app'

function seededRandom(seed = 123456): RandomSource {
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

function expectValidChoices(question: LearningQuestion) {
  const values = question.choices.map((choice) => choice.value)
  expect(values).toHaveLength(4)
  expect(new Set(values).size).toBe(4)
  expect(values).toContain(question.correctAnswer)
}

const LEGACY_SKILLS_BY_GRADE: Record<Grade, QuestionSkillId[]> = {
  1: ['g1-add-within-10', 'g1-sub-within-10', 'g1-add-with-carry', 'g1-sub-with-borrow'],
  2: ['g2-add-two-one', 'g2-sub-two-one', 'g2-multiplication-2-5', 'g2-multiplication-6-9'],
  3: ['g3-multiply-two-one', 'g3-division-exact', 'g3-division-remainder'],
}

const LEGACY_PROBLEM_TYPE: Partial<Record<QuestionSkillId, QuestionProblemType>> = {
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

function generateEachLegacySkill(grade: Grade): Array<[QuestionSkillId, LearningQuestion]> {
  const random = seededRandom(grade * 100)
  return LEGACY_SKILLS_BY_GRADE[grade].map((skillId) => [
    skillId,
    generateQuestion(grade, skillId, random, LEGACY_PROBLEM_TYPE[skillId]),
  ])
}

describe('grade question generation', () => {
  it('小学1年の4単元をルールどおり生成する', () => {
    for (const [skillId, question] of generateEachLegacySkill(1)) {
      const { left, right } = parse(question)
      expect(question.grade).toBe(1)
      expectValidChoices(question)
      if (skillId === 'g1-add-within-10') expect(left + right).toBeLessThanOrEqual(10)
      if (skillId === 'g1-sub-within-10') expect(left - right).toBeGreaterThanOrEqual(0)
      if (skillId === 'g1-add-with-carry') {
        expect(left).toBeLessThan(10)
        expect(right).toBeLessThan(10)
        expect(left + right).toBeGreaterThanOrEqual(10)
        expect(left + right).toBeLessThanOrEqual(18)
      }
      if (skillId === 'g1-sub-with-borrow') {
        expect(left).toBeGreaterThanOrEqual(10)
        expect(right).toBeGreaterThan(0)
        expect(left - right).toBeGreaterThanOrEqual(0)
        expect(left % 10).toBeLessThan(right)
      }
    }
  })

  it('小学2年の従来4単元をルールどおり生成する', () => {
    for (const [skillId, question] of generateEachLegacySkill(2)) {
      const { left, right } = parse(question)
      expect(question.grade).toBe(2)
      expectValidChoices(question)
      if (skillId === 'g2-add-two-one' || skillId === 'g2-sub-two-one') {
        expect(left).toBeGreaterThanOrEqual(10)
        expect(left).toBeLessThanOrEqual(99)
        expect(right).toBeGreaterThanOrEqual(1)
        expect(right).toBeLessThanOrEqual(9)
      }
      if (skillId === 'g2-multiplication-2-5') {
        expect(left).toBeGreaterThanOrEqual(2)
        expect(left).toBeLessThanOrEqual(5)
        expect(right).toBeGreaterThanOrEqual(1)
        expect(right).toBeLessThanOrEqual(9)
      }
      if (skillId === 'g2-multiplication-6-9') {
        expect(left).toBeGreaterThanOrEqual(6)
        expect(left).toBeLessThanOrEqual(9)
        expect(right).toBeGreaterThanOrEqual(1)
        expect(right).toBeLessThanOrEqual(9)
      }
    }
  })

  it('小学3年の従来3単元をルールどおり生成する', () => {
    for (const [skillId, question] of generateEachLegacySkill(3)) {
      const { left, right } = parse(question)
      expect(question.grade).toBe(3)
      expectValidChoices(question)
      if (skillId === 'g3-multiply-two-one') {
        expect(left).toBeGreaterThanOrEqual(10)
        expect(left).toBeLessThanOrEqual(99)
        expect(right).toBeGreaterThanOrEqual(2)
        expect(right).toBeLessThanOrEqual(9)
      }
      if (skillId === 'g3-division-exact') {
        expect(right).toBeGreaterThanOrEqual(2)
        expect(right).toBeLessThanOrEqual(9)
        expect(left % right).toBe(0)
        expect(left / right).toBe(question.correctAnswer)
      }
      if (skillId === 'g3-division-remainder') {
        const quotient = Math.floor(left / right)
        const remainder = left % right
        expect(remainder).toBeGreaterThanOrEqual(1)
        expect(remainder).toBeLessThan(right)
        expect(question.correctAnswer).toBe(`${quotient} あまり ${remainder}`)
        expect(question.hint).toContain(`${right}を${quotient}回たすと`)
      }
    }
  })

  it('正答位置を固定せず、全問題で選択肢を重複させない', () => {
    const random = seededRandom(9876)
    const positions = new Set<number>()
    for (let index = 0; index < 30; index += 1) {
      const question = generateQuestion(2, 'g2-add-two-one', random)
      expectValidChoices(question)
      positions.add(question.choices.findIndex((choice) => choice.value === question.correctAnswer))
    }
    expect(positions.size).toBeGreaterThan(1)
  })

  it.each([
    [0, 6],
    [0.25, 7],
    [0.5, 8],
    [0.75, 9],
  ])('九九%i相当の乱数で%iの段を生成する', (randomValue, expectedTable) => {
    const question = generateQuestion(
      2,
      'g2-multiplication-6-9',
      () => randomValue,
      'g2-multiplication',
    )
    expect(parse(question).left).toBe(expectedTable)
    expectValidChoices(question)
  })

  it('あまりのある割り算を4択・重複なしで生成する', () => {
    const question = generateQuestion(
      3,
      'g3-division-remainder',
      seededRandom(555),
      'g3-division-remainder',
    )
    const { left, right } = parse(question)
    expect(question.correctAnswer).toBe(
      `${Math.floor(left / right)} あまり ${left % right}`,
    )
    expectValidChoices(question)
  })

  it.each([1, 2, 3] as Grade[])('小学%s年の10問を重複なしで生成する', (grade) => {
    const questions = generateQuestionSession(grade, 10, seededRandom(grade * 999))
    expect(questions).toHaveLength(10)
    expect(new Set(questions.map((question) => question.prompt)).size).toBe(10)
    expect(new Set(questions.map((question) => question.skillId))).toEqual(new Set(getGradeSkillIds(grade)))
  })
})
