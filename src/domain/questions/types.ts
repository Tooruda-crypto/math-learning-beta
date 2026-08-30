import type { Grade } from '../../types/app'

export interface QuestionChoice {
  id: string
  label: string
  value: QuestionAnswer
}

export type QuestionAnswer = number | string

export type QuestionPresentationType =
  | 'calculation'
  | 'fill-blank'
  | 'comparison'
  | 'word-problem'
  | 'quotient'
  | 'remainder'
  | 'fraction'

export type QuestionProblemType =
  | 'g1-add-basic'
  | 'g1-add-three'
  | 'g1-sub-basic'
  | 'g1-mixed-three'
  | 'g1-add-missing'
  | 'g1-sub-missing'
  | 'g1-compare'
  | 'g1-add-word'
  | 'g1-sub-word'
  | 'g1-add-carry'
  | 'g1-add-carry-missing'
  | 'g1-sub-borrow'
  | 'g1-sub-borrow-missing'
  | 'g2-add-two-one'
  | 'g2-sub-two-one'
  | 'g2-add-two-two'
  | 'g2-add-two-two-missing'
  | 'g2-add-two-two-word'
  | 'g2-sub-two-two'
  | 'g2-sub-two-two-missing'
  | 'g2-sub-two-two-word'
  | 'g2-multiplication'
  | 'g2-multiplication-missing'
  | 'g2-multiplication-word'
  | 'g3-add-three'
  | 'g3-sub-three'
  | 'g3-multiply-two-one'
  | 'g3-multiplication-missing'
  | 'g3-division-exact'
  | 'g3-division-missing'
  | 'g3-division-word'
  | 'g3-division-remainder'
  | 'g3-division-quotient'
  | 'g3-division-remainder-only'
  | 'g3-division-remainder-word'
  | 'g3-fraction-basic'

export interface LearningQuestion {
  id: string
  grade: Grade
  skillId: string
  prompt: string
  correctAnswer: QuestionAnswer
  choices: QuestionChoice[]
  hint: string
  difficulty: 1 | 2 | 3
  /** Version 3/4で保存された途中問題には存在しないため、UIはcalculationを既定値にする。 */
  presentationType?: QuestionPresentationType
  problemType?: QuestionProblemType
}

export type QuestionSkillId =
  | 'g1-add-within-10'
  | 'g1-sub-within-10'
  | 'g1-add-with-carry'
  | 'g1-sub-with-borrow'
  | 'g2-add-two-one'
  | 'g2-sub-two-one'
  | 'g2-add-two-two'
  | 'g2-sub-two-two'
  | 'g2-multiplication-2-5'
  | 'g2-multiplication-6-9'
  | 'g3-add-three'
  | 'g3-sub-three'
  | 'g3-multiply-two-one'
  | 'g3-division-exact'
  | 'g3-division-remainder'
  | 'g3-fraction-basic'

export type RandomSource = () => number
