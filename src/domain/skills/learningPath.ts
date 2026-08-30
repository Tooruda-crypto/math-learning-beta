import type { Grade } from '../../types/app'
import type { QuestionSkillId } from '../questions/types'

export const SKILL_SEQUENCE_BY_GRADE: Record<
  Grade,
  readonly QuestionSkillId[]
> = {
  1: [
    'g1-add-within-10',
    'g1-sub-within-10',
    'g1-add-with-carry',
    'g1-sub-with-borrow',
  ],
  2: [
    'g2-add-two-one',
    'g2-sub-two-one',
    'g2-add-two-two',
    'g2-sub-two-two',
    'g2-multiplication-2-5',
    'g2-multiplication-6-9',
  ],
  3: [
    'g3-add-three',
    'g3-sub-three',
    'g3-multiply-two-one',
    'g3-division-exact',
    'g3-division-remainder',
    'g3-fraction-basic',
  ],
}

export const SKILL_NAMES: Record<QuestionSkillId, string> = {
  'g1-add-within-10': '10までの足し算',
  'g1-sub-within-10': '10までの引き算',
  'g1-add-with-carry': '繰り上がりのある足し算',
  'g1-sub-with-borrow': '繰り下がりのある引き算',
  'g2-add-two-one': '2桁＋1桁',
  'g2-sub-two-one': '2桁−1桁',
  'g2-add-two-two': '2桁＋2桁',
  'g2-sub-two-two': '2桁−2桁',
  'g2-multiplication-2-5': '九九 2〜5の段',
  'g2-multiplication-6-9': '九九 6〜9の段',
  'g3-add-three': '3桁の足し算',
  'g3-sub-three': '3桁の引き算',
  'g3-multiply-two-one': '2桁×1桁',
  'g3-division-exact': 'あまりのない割り算',
  'g3-division-remainder': 'あまりのある割り算',
  'g3-fraction-basic': '分数のはじめ',
}
