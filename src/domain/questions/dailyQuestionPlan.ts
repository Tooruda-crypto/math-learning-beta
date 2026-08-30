import type { Grade, SkillProgress } from '../../types/app'
import { SKILL_SEQUENCE_BY_GRADE } from '../skills/learningPath'
import {
  assessSkillProgress,
  type SkillAssessment,
} from '../skills/proficiency'
import { generateQuestionsForSkillPlan } from './generator'
import type {
  LearningQuestion,
  QuestionSkillId,
  RandomSource,
} from './types'

export type DailyQuestionSlotKind =
  | 'current'
  | 'weakness'
  | 'review'
  | 'challenge'

export interface DailyQuestionSlot {
  kind: DailyQuestionSlotKind
  skillId: QuestionSkillId
}

export interface DailyQuestionPlan {
  grade: Grade
  currentSkillId: QuestionSkillId
  challengeSkillId: QuestionSkillId
  assessments: Partial<Record<QuestionSkillId, SkillAssessment>>
  slots: DailyQuestionSlot[]
}

export interface PersonalizedQuestionSession {
  plan: DailyQuestionPlan
  questions: LearningQuestion[]
}

const WEAK_STATES = new Set(['FOCUS', 'REVIEW'])
const CURRENT_STATES = new Set(['UNSEEN', 'LEARNING', 'STABLE'])

function cycleSlots(
  kind: DailyQuestionSlotKind,
  count: number,
  candidates: readonly QuestionSkillId[],
): DailyQuestionSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    kind,
    skillId: candidates[index % candidates.length],
  }))
}

function spreadSlots(slots: DailyQuestionSlot[]): DailyQuestionSlot[] {
  const remaining = [...slots]
  const result: DailyQuestionSlot[] = []

  while (remaining.length > 0) {
    const counts = new Map<QuestionSkillId, number>()
    for (const slot of remaining) {
      counts.set(slot.skillId, (counts.get(slot.skillId) ?? 0) + 1)
    }

    const previousSkillId = result.at(-1)?.skillId
    const available = remaining.filter(
      (slot) => slot.skillId !== previousSkillId,
    )
    const candidates = available.length > 0 ? available : remaining
    const selected = [...candidates].sort(
      (left, right) =>
        (counts.get(right.skillId) ?? 0) -
        (counts.get(left.skillId) ?? 0),
    )[0]
    const selectedIndex = remaining.indexOf(selected)

    result.push(selected)
    remaining.splice(selectedIndex, 1)
  }

  return result
}

function getChallengeSkillId(
  sequence: readonly QuestionSkillId[],
  currentSkillId: QuestionSkillId,
): QuestionSkillId {
  const currentIndex = sequence.indexOf(currentSkillId)
  return sequence[currentIndex + 1] ?? sequence.find(
    (skillId) => skillId !== currentSkillId,
  ) ?? currentSkillId
}

export function createDailyQuestionPlan(
  grade: Grade,
  skillProgress: Record<string, SkillProgress>,
): DailyQuestionPlan {
  const sequence = SKILL_SEQUENCE_BY_GRADE[grade]
  const assessments = Object.fromEntries(
    sequence.map((skillId) => [
      skillId,
      assessSkillProgress(skillProgress[skillId]),
    ]),
  ) as Partial<Record<QuestionSkillId, SkillAssessment>>
  const hasHistory = sequence.some(
    (skillId) => (skillProgress[skillId]?.attempts ?? 0) > 0,
  )

  if (!hasHistory) {
    const currentSkills = sequence.slice(0, Math.min(2, sequence.length))
    const challengeSkillId = sequence[Math.min(2, sequence.length - 1)]
    const slots = [
      ...cycleSlots('current', 6, currentSkills),
      ...cycleSlots('review', 3, [sequence[0]]),
      ...cycleSlots('challenge', 1, [challengeSkillId]),
    ]

    return {
      grade,
      currentSkillId: sequence[0],
      challengeSkillId,
      assessments,
      slots: spreadSlots(slots),
    }
  }

  const currentSkillId =
    sequence.find((skillId) =>
      CURRENT_STATES.has(assessments[skillId]!.state),
    ) ?? sequence.find(
      (skillId) => assessments[skillId]!.state !== 'MASTERED',
    ) ?? sequence.at(-1)!
  const challengeSkillId = getChallengeSkillId(sequence, currentSkillId)
  const weaknessSkills = sequence.filter((skillId) =>
    WEAK_STATES.has(assessments[skillId]!.state),
  )
  const learnedReviewSkills = sequence.filter((skillId) => {
    const state = assessments[skillId]!.state
    return (
      skillId !== currentSkillId &&
      skillId !== challengeSkillId &&
      (state === 'STABLE' || state === 'MASTERED')
    )
  })
  const fallbackReviewSkills = sequence.filter(
    (skillId) =>
      skillId !== currentSkillId &&
      !WEAK_STATES.has(assessments[skillId]!.state),
  )
  const reviewSkills =
    learnedReviewSkills.length > 0
      ? learnedReviewSkills
      : fallbackReviewSkills.length > 0
        ? fallbackReviewSkills
        : [currentSkillId]

  const slots = weaknessSkills.length > 0
    ? [
        ...cycleSlots('current', 4, [currentSkillId]),
        ...cycleSlots('weakness', 3, weaknessSkills),
        ...cycleSlots('review', 2, reviewSkills),
        ...cycleSlots('challenge', 1, [challengeSkillId]),
      ]
    : [
        ...cycleSlots('current', 6, [currentSkillId]),
        ...cycleSlots('review', 3, reviewSkills),
        ...cycleSlots('challenge', 1, [challengeSkillId]),
      ]

  return {
    grade,
    currentSkillId,
    challengeSkillId,
    assessments,
    slots: spreadSlots(slots),
  }
}

export function createPersonalizedQuestionSession(
  grade: Grade,
  skillProgress: Record<string, SkillProgress>,
  random: RandomSource = Math.random,
): PersonalizedQuestionSession {
  const plan = createDailyQuestionPlan(grade, skillProgress)
  const questions = generateQuestionsForSkillPlan(
    grade,
    plan.slots.map((slot) => slot.skillId),
    random,
  )

  return { plan, questions }
}
