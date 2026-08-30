import type { QuestionSkillId } from './types'

export function createQuestionHint(
  skillId: QuestionSkillId,
  left: number,
  right: number,
): string {
  switch (skillId) {
    case 'g1-add-within-10':
      return `${left}から、${right}こ先を数えてみよう。`
    case 'g1-sub-within-10':
      return `${left}から、${right}こ戻って数えてみよう。`
    case 'g1-add-with-carry':
      return `${left}に${10 - left}をたすと10だね。`
    case 'g1-sub-with-borrow':
      return `${left}から${left % 10}をひくと${left - (left % 10)}になるよ。`
    case 'g2-add-two-one':
    case 'g2-add-two-two':
    case 'g3-add-three':
      return `${left}の1の位に${right}をたしてみよう。`
    case 'g2-sub-two-one':
    case 'g2-sub-two-two':
    case 'g3-sub-three':
      return `${left}の1の位から${right}をひけるか考えよう。`
    case 'g2-multiplication-2-5':
    case 'g2-multiplication-6-9':
    case 'g3-multiply-two-one':
      return `${left}が${right}こ分だよ。`
    case 'g3-division-exact':
      return `${right}を何回たすと${left}になるかな？`
    case 'g3-division-remainder': {
      const quotient = Math.floor(left / right)
      return `${right}を${quotient}回たすと${right * quotient}だね。${left}まであといくつかな？`
    }
    case 'g3-fraction-basic':
      return '同じ大きさにいくつ分けたか考えてみよう。'
  }
}
