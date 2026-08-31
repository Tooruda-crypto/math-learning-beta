import type { Grade } from '../../types/app'
import { createQuestionHint } from './hints'
import {
  createPriority9Draft,
  PRIORITY_9_PROBLEM_TYPES,
} from './priority9'
import type {
  LearningQuestion,
  QuestionAnswer,
  QuestionChoice,
  QuestionPresentationType,
  QuestionProblemType,
  QuestionSkillId,
  RandomSource,
  QuestionVisual,
} from './types'

interface WordItem { name: string; counter: string }
interface QuestionDraft {
  prompt: string
  answer: QuestionAnswer
  hint: string
  difficulty: 1 | 2 | 3
  presentationType: QuestionPresentationType
  choiceValues?: QuestionAnswer[]
  choiceMin?: number
  choiceMax?: number
  visual?: QuestionVisual
}

const WORD_ITEMS: readonly WordItem[] = [
  { name: 'りんご', counter: 'こ' }, { name: 'みかん', counter: 'こ' },
  { name: 'ボール', counter: 'こ' }, { name: 'シール', counter: 'まい' },
  { name: 'えんぴつ', counter: 'ほん' },
]

const FRACTION_ITEMS = ['ピザ', 'ケーキ', 'かみ', 'テープ', 'チョコ'] as const

const PRIORITY_8_PROBLEM_TYPES: readonly QuestionProblemType[] = [
  'g1-add-three', 'g1-mixed-three', 'g1-add-missing', 'g1-sub-missing',
  'g1-compare', 'g1-add-word', 'g1-sub-word', 'g1-add-carry-missing',
  'g1-sub-borrow-missing', 'g2-add-two-two', 'g2-add-two-two-missing',
  'g2-add-two-two-word', 'g2-sub-two-two', 'g2-sub-two-two-missing',
  'g2-sub-two-two-word', 'g2-multiplication-missing', 'g2-multiplication-word',
  'g3-add-three', 'g3-sub-three', 'g3-multiplication-missing',
  'g3-division-missing', 'g3-division-word', 'g3-division-quotient',
  'g3-division-remainder-only', 'g3-division-remainder-word', 'g3-fraction-basic',
]

const SKILL_PROBLEM_TYPES: Record<QuestionSkillId, readonly QuestionProblemType[]> = {
  'g1-add-within-10': ['g1-add-basic', 'g1-add-three', 'g1-add-missing', 'g1-compare', 'g1-add-word', 'g1-add-word-varied'],
  'g1-sub-within-10': ['g1-sub-basic', 'g1-mixed-three', 'g1-sub-missing', 'g1-sub-word', 'g1-sub-word-varied'],
  'g1-add-with-carry': ['g1-add-carry', 'g1-add-carry-missing'],
  'g1-sub-with-borrow': ['g1-sub-borrow', 'g1-sub-borrow-missing'],
  'g2-add-two-one': ['g2-add-two-one'],
  'g2-sub-two-one': ['g2-sub-two-one'],
  'g2-add-two-two': ['g2-add-two-two', 'g2-add-two-two-missing', 'g2-add-two-two-word'],
  'g2-sub-two-two': ['g2-sub-two-two', 'g2-sub-two-two-missing', 'g2-sub-two-two-word'],
  'g2-multiplication-2-5': ['g2-multiplication', 'g2-multiplication-missing', 'g2-multiplication-word', 'g2-multiplication-word-varied'],
  'g2-multiplication-6-9': ['g2-multiplication', 'g2-multiplication-missing', 'g2-multiplication-word', 'g2-multiplication-word-varied'],
  'g3-add-three': ['g3-add-three'],
  'g3-sub-three': ['g3-sub-three'],
  'g3-multiply-two-one': ['g3-multiply-two-one', 'g3-multiplication-missing'],
  'g3-division-exact': ['g3-division-exact', 'g3-division-missing', 'g3-division-word', 'g3-division-word-varied'],
  'g3-division-remainder': ['g3-division-remainder', 'g3-division-quotient', 'g3-division-remainder-only', 'g3-division-remainder-word', 'g3-division-word-varied'],
  'g3-fraction-basic': ['g3-fraction-basic'],
  'g1-number-concept': ['g1-number-concept'],
  'g1-time': ['g1-time'],
  'g1-length': ['g1-length'],
  'g1-money': ['g1-money'],
  'g2-number-concept': ['g2-number-concept'],
  'g2-time': ['g2-time'],
  'g2-length': ['g2-length'],
  'g2-money': ['g2-money'],
  'g3-number-concept': ['g3-number-concept'],
  'g3-time': ['g3-time'],
  'g3-length': ['g3-length'],
  'g3-money': ['g3-money'],
}

const DEFAULT_SKILL_BY_PROBLEM_TYPE: Record<QuestionProblemType, QuestionSkillId> = {
  'g1-add-basic': 'g1-add-within-10', 'g1-add-three': 'g1-add-within-10',
  'g1-sub-basic': 'g1-sub-within-10', 'g1-mixed-three': 'g1-sub-within-10',
  'g1-add-missing': 'g1-add-within-10', 'g1-sub-missing': 'g1-sub-within-10',
  'g1-compare': 'g1-add-within-10', 'g1-add-word': 'g1-add-within-10',
  'g1-sub-word': 'g1-sub-within-10', 'g1-add-carry': 'g1-add-with-carry',
  'g1-add-carry-missing': 'g1-add-with-carry', 'g1-sub-borrow': 'g1-sub-with-borrow',
  'g1-sub-borrow-missing': 'g1-sub-with-borrow', 'g2-add-two-one': 'g2-add-two-one',
  'g2-sub-two-one': 'g2-sub-two-one', 'g2-add-two-two': 'g2-add-two-two',
  'g2-add-two-two-missing': 'g2-add-two-two', 'g2-add-two-two-word': 'g2-add-two-two',
  'g2-sub-two-two': 'g2-sub-two-two', 'g2-sub-two-two-missing': 'g2-sub-two-two',
  'g2-sub-two-two-word': 'g2-sub-two-two', 'g2-multiplication': 'g2-multiplication-2-5',
  'g2-multiplication-missing': 'g2-multiplication-2-5', 'g2-multiplication-word': 'g2-multiplication-2-5',
  'g3-add-three': 'g3-add-three', 'g3-sub-three': 'g3-sub-three',
  'g3-multiply-two-one': 'g3-multiply-two-one', 'g3-multiplication-missing': 'g3-multiply-two-one',
  'g3-division-exact': 'g3-division-exact', 'g3-division-missing': 'g3-division-exact',
  'g3-division-word': 'g3-division-exact', 'g3-division-remainder': 'g3-division-remainder',
  'g3-division-quotient': 'g3-division-remainder', 'g3-division-remainder-only': 'g3-division-remainder',
  'g3-division-remainder-word': 'g3-division-remainder', 'g3-fraction-basic': 'g3-fraction-basic',
  'g1-add-word-varied': 'g1-add-within-10', 'g1-sub-word-varied': 'g1-sub-within-10',
  'g2-multiplication-word-varied': 'g2-multiplication-2-5',
  'g3-division-word-varied': 'g3-division-exact',
  'g1-number-concept': 'g1-number-concept', 'g1-time': 'g1-time',
  'g1-length': 'g1-length', 'g1-money': 'g1-money',
  'g2-number-concept': 'g2-number-concept', 'g2-time': 'g2-time',
  'g2-length': 'g2-length', 'g2-money': 'g2-money',
  'g3-number-concept': 'g3-number-concept', 'g3-time': 'g3-time',
  'g3-length': 'g3-length', 'g3-money': 'g3-money',
}

const GRADE_SKILL_PLANS: Record<Grade, QuestionSkillId[]> = {
  1: ['g1-add-within-10', 'g1-sub-within-10', 'g1-add-with-carry', 'g1-sub-with-borrow', 'g1-number-concept', 'g1-time', 'g1-length', 'g1-money'],
  2: ['g2-add-two-one', 'g2-sub-two-one', 'g2-add-two-two', 'g2-sub-two-two', 'g2-multiplication-2-5', 'g2-multiplication-6-9', 'g2-number-concept', 'g2-time', 'g2-length', 'g2-money'],
  3: ['g3-multiply-two-one', 'g3-division-exact', 'g3-division-remainder', 'g3-add-three', 'g3-sub-three', 'g3-fraction-basic', 'g3-number-concept', 'g3-time', 'g3-length', 'g3-money'],
}

function gradeForSkill(skillId: QuestionSkillId): Grade {
  if (skillId.startsWith('g1-')) return 1
  if (skillId.startsWith('g2-')) return 2
  return 3
}

function randomInt(min: number, max: number, random: RandomSource): number {
  return Math.floor(random() * (max - min + 1)) + min
}

function pick<T>(items: readonly T[], random: RandomSource): T {
  return items[randomInt(0, items.length - 1, random)]
}

function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = randomInt(0, index, random)
    const current = shuffled[index]
    shuffled[index] = shuffled[target]
    shuffled[target] = current
  }
  return shuffled
}

function wordItem(random: RandomSource): WordItem { return pick(WORD_ITEMS, random) }

function numericChoices(answer: number, random: RandomSource, min = 0, max = Number.POSITIVE_INFINITY): QuestionChoice[] {
  const scale = answer >= 100 ? 10 : answer >= 30 ? 5 : 1
  const offsets = shuffle([-2 * scale, -scale, -2, -1, 1, 2, scale, 2 * scale], random)
  const values = new Set<number>([answer])
  for (const offset of offsets) {
    const candidate = answer + offset
    if (candidate >= min && candidate <= max) values.add(candidate)
    if (values.size === 4) break
  }
  for (let candidate = min; values.size < 4 && candidate <= max; candidate += 1) values.add(candidate)
  for (let candidate = Math.max(min, answer + 1); values.size < 4; candidate += 1) values.add(candidate)
  return shuffle([...values].slice(0, 4), random).map((value) => ({ id: String(value), label: String(value), value }))
}

function valueChoices(values: readonly QuestionAnswer[], random: RandomSource): QuestionChoice[] {
  return shuffle([...new Set(values)].slice(0, 4), random).map((value) => ({ id: String(value), label: String(value), value }))
}

function standardDraft(skillId: QuestionSkillId, left: number, right: number, operator: '+' | '−' | '×' | '÷', answer: number, difficulty: 1 | 2 | 3): QuestionDraft {
  return { prompt: `${left} ${operator} ${right} = ?`, answer, hint: createQuestionHint(skillId, left, right), difficulty, presentationType: 'calculation' }
}

function remainderResultChoices(quotient: number, remainder: number, divisor: number): string[] {
  const alternate = remainder === divisor - 1 ? Math.max(0, remainder - 1) : remainder + 1
  return [`${quotient} あまり ${remainder}`, `${quotient + 1} あまり ${remainder}`, `${Math.max(0, quotient - 1)} あまり ${remainder}`, `${quotient} あまり ${alternate}`]
}

function createDraft(problemType: QuestionProblemType, skillId: QuestionSkillId, random: RandomSource): QuestionDraft {
  const priority9Draft = createPriority9Draft(problemType, skillId, random)
  if (priority9Draft) return priority9Draft
  switch (problemType) {
    case 'g1-add-basic': { const a = randomInt(0, 10, random); const b = randomInt(0, 10 - a, random); return standardDraft(skillId, a, b, '+', a + b, 1) }
    case 'g1-add-three': { const a = randomInt(1, 4, random); const b = randomInt(1, Math.min(4, 9 - a), random); const c = randomInt(1, 10 - a - b, random); return { prompt: `${a} + ${b} + ${c} = ?`, answer: a + b + c, hint: `まず${a}と${b}をたしてみよう。`, difficulty: 2, presentationType: 'calculation' } }
    case 'g1-sub-basic': { const a = randomInt(0, 10, random); const b = randomInt(0, a, random); return standardDraft(skillId, a, b, '−', a - b, 1) }
    case 'g1-mixed-three': { const a = randomInt(5, 10, random); const b = randomInt(1, a - 1, random); const after = a - b; const c = randomInt(1, 10 - after, random); return { prompt: `${a} − ${b} + ${c} = ?`, answer: after + c, hint: `まず${a}から${b}をひいてみよう。`, difficulty: 2, presentationType: 'calculation' } }
    case 'g1-add-missing': { const answer = randomInt(1, 8, random); const known = randomInt(1, 10 - answer, random); return { prompt: `□ + ${known} = ${answer + known}`, answer, hint: `${answer + known}から${known}をひいてみよう。`, difficulty: 2, presentationType: 'fill-blank' } }
    case 'g1-sub-missing': { const left = randomInt(4, 10, random); const answer = randomInt(1, left - 1, random); return { prompt: `${left} − □ = ${left - answer}`, answer, hint: `${left}からいくつひくと${left - answer}になるかな？`, difficulty: 2, presentationType: 'fill-blank' } }
    case 'g1-compare': {
      const relation = randomInt(0, 2, random); const base = randomInt(4, 8, random)
      const totalA = relation === 0 ? base + 1 : base; const totalB = relation === 1 ? base + 1 : base
      const leftA = randomInt(1, totalA - 1, random); const leftB = randomInt(1, totalB - 1, random)
      const answer = relation === 0 ? 'Aのほうが大きい' : relation === 1 ? 'Bのほうが大きい' : '同じ'
      return { prompt: `A：${leftA} + ${totalA - leftA}\nB：${leftB} + ${totalB - leftB}\nどちらが大きい？`, answer, hint: 'AとBをそれぞれたしてくらべてみよう。', difficulty: 2, presentationType: 'comparison', choiceValues: ['Aのほうが大きい', 'Bのほうが大きい', '同じ', 'どちらでもない'] }
    }
    case 'g1-add-word': { const target = wordItem(random); const a = randomInt(1, 7, random); const b = randomInt(1, 10 - a, random); return { prompt: `${target.name}が ${a}${target.counter} あります。\n${b}${target.counter} もらいました。\nぜんぶで なん${target.counter}？`, answer: a + b, hint: `${a}と${b}をたしてみよう。`, difficulty: 2, presentationType: 'word-problem' } }
    case 'g1-sub-word': { const target = wordItem(random); const a = randomInt(4, 10, random); const b = randomInt(1, a - 1, random); return { prompt: `${target.name}が ${a}${target.counter} あります。\n${b}${target.counter} つかいました。\nのこりは なん${target.counter}？`, answer: a - b, hint: `${a}から${b}をひいてみよう。`, difficulty: 2, presentationType: 'word-problem' } }
    case 'g1-add-carry': { const a = randomInt(2, 9, random); const b = randomInt(10 - a, 9, random); return standardDraft(skillId, a, b, '+', a + b, 2) }
    case 'g1-add-carry-missing': { const answer = randomInt(2, 9, random); const known = randomInt(10 - answer, 9, random); return { prompt: `□ + ${known} = ${answer + known}`, answer, hint: `${answer + known}から${known}をひいてみよう。`, difficulty: 2, presentationType: 'fill-blank' } }
    case 'g1-sub-borrow': { const a = randomInt(11, 18, random); const b = randomInt((a % 10) + 1, 9, random); return standardDraft(skillId, a, b, '−', a - b, 2) }
    case 'g1-sub-borrow-missing': { const left = randomInt(11, 18, random); const answer = randomInt((left % 10) + 1, 9, random); return { prompt: `${left} − □ = ${left - answer}`, answer, hint: `${left}からいくつひくと${left - answer}になるかな？`, difficulty: 2, presentationType: 'fill-blank' } }
    case 'g2-add-two-one': { const a = randomInt(10, 99, random); const b = randomInt(1, 9, random); return standardDraft(skillId, a, b, '+', a + b, 1) }
    case 'g2-sub-two-one': { const a = randomInt(10, 99, random); const b = randomInt(1, 9, random); return standardDraft(skillId, a, b, '−', a - b, 1) }
    case 'g2-add-two-two': { const a = randomInt(10, 79, random); const b = randomInt(10, 99 - a, random); return standardDraft(skillId, a, b, '+', a + b, 2) }
    case 'g2-add-two-two-missing': { const answer = randomInt(10, 49, random); const known = randomInt(10, 99 - answer, random); return { prompt: `□ + ${known} = ${answer + known}`, answer, hint: `${answer + known}から${known}をひいてみよう。`, difficulty: 2, presentationType: 'fill-blank' } }
    case 'g2-add-two-two-word': { const target = wordItem(random); const a = randomInt(10, 69, random); const b = randomInt(10, 99 - a, random); return { prompt: `${target.name}が ${a}${target.counter} あります。\n${b}${target.counter} ふえました。\nぜんぶで なん${target.counter}？`, answer: a + b, hint: `${a}と${b}をたしてみよう。`, difficulty: 2, presentationType: 'word-problem' } }
    case 'g2-sub-two-two': { const a = randomInt(30, 99, random); const b = randomInt(10, a - 1, random); return standardDraft(skillId, a, b, '−', a - b, 2) }
    case 'g2-sub-two-two-missing': { const left = randomInt(30, 99, random); const answer = randomInt(10, left - 1, random); return { prompt: `${left} − □ = ${left - answer}`, answer, hint: `${left}から${left - answer}になるまで、いくつひくか考えよう。`, difficulty: 2, presentationType: 'fill-blank' } }
    case 'g2-sub-two-two-word': { const target = wordItem(random); const a = randomInt(30, 99, random); const b = randomInt(10, a - 1, random); return { prompt: `${target.name}が ${a}${target.counter} あります。\n${b}${target.counter} つかいました。\nのこりは なん${target.counter}？`, answer: a - b, hint: `${a}から${b}をひいてみよう。`, difficulty: 2, presentationType: 'word-problem' } }
    case 'g2-multiplication': { const a = skillId === 'g2-multiplication-6-9' ? randomInt(6, 9, random) : randomInt(2, 5, random); const b = randomInt(1, 9, random); return standardDraft(skillId, a, b, '×', a * b, 2) }
    case 'g2-multiplication-missing': { const a = skillId === 'g2-multiplication-6-9' ? randomInt(6, 9, random) : randomInt(2, 5, random); const answer = randomInt(1, 9, random); return { prompt: `${a} × □ = ${a * answer}`, answer, hint: `${a}のだんを思い出してみよう。`, difficulty: 2, presentationType: 'fill-blank', choiceMin: 1, choiceMax: 9 } }
    case 'g2-multiplication-word': { const target = wordItem(random); const each = skillId === 'g2-multiplication-6-9' ? randomInt(6, 9, random) : randomInt(2, 5, random); const groups = randomInt(2, 9, random); return { prompt: `1ふくろに ${target.name}が ${each}${target.counter}ずつ 入っています。\n${groups}ふくろでは ぜんぶで なん${target.counter}？`, answer: each * groups, hint: `${each}が${groups}こ分と考えよう。`, difficulty: 2, presentationType: 'word-problem' } }
    case 'g3-add-three': { const a = randomInt(100, 799, random); const b = random() < .5 ? randomInt(10, 99, random) : randomInt(100, 999 - a, random); return standardDraft(skillId, a, b, '+', a + b, 2) }
    case 'g3-sub-three': { const a = randomInt(200, 999, random); const b = random() < .5 ? randomInt(10, 99, random) : randomInt(100, a - 1, random); return standardDraft(skillId, a, b, '−', a - b, 2) }
    case 'g3-multiply-two-one': { const a = randomInt(10, 99, random); const b = randomInt(2, 9, random); return standardDraft(skillId, a, b, '×', a * b, 2) }
    case 'g3-multiplication-missing': { const known = randomInt(2, 9, random); const answer = randomInt(2, 9, random); return { prompt: `□ × ${known} = ${known * answer}`, answer, hint: `${known}のだんを思い出してみよう。`, difficulty: 2, presentationType: 'fill-blank', choiceMin: 1, choiceMax: 9 } }
    case 'g3-division-exact': { const divisor = randomInt(2, 9, random); const answer = randomInt(2, 9, random); return standardDraft(skillId, divisor * answer, divisor, '÷', answer, 2) }
    case 'g3-division-missing': { const divisor = randomInt(2, 9, random); const quotient = randomInt(2, 9, random); return { prompt: `□ ÷ ${divisor} = ${quotient}`, answer: divisor * quotient, hint: `${divisor}を${quotient}回たすといくつかな？`, difficulty: 2, presentationType: 'fill-blank' } }
    case 'g3-division-word': { const target = wordItem(random); const people = randomInt(2, 9, random); const each = randomInt(2, 9, random); return { prompt: `${people * each}${target.counter}の ${target.name}を\n${people}人で 同じ数ずつ分けます。\n1人 なん${target.counter}？`, answer: each, hint: `${people}を何回たすと${people * each}になるか考えよう。`, difficulty: 2, presentationType: 'word-problem' } }
    case 'g3-division-remainder': { const divisor = randomInt(2, 9, random); const quotient = randomInt(1, 9, random); const remainder = randomInt(1, divisor - 1, random); const dividend = divisor * quotient + remainder; return { prompt: `${dividend} ÷ ${divisor} = ?`, answer: `${quotient} あまり ${remainder}`, hint: `${divisor}を${quotient}回たすと${divisor * quotient}だね。${dividend}まであといくつかな？`, difficulty: 3, presentationType: 'calculation', choiceValues: remainderResultChoices(quotient, remainder, divisor) } }
    case 'g3-division-quotient': { const divisor = randomInt(2, 9, random); const quotient = randomInt(1, 9, random); const remainder = randomInt(1, divisor - 1, random); const dividend = divisor * quotient + remainder; return { prompt: `${dividend} ÷ ${divisor}\n商はいくつ？`, answer: quotient, hint: `${divisor}を何回たすと${dividend}をこえないかな？`, difficulty: 3, presentationType: 'quotient', choiceMin: 0 } }
    case 'g3-division-remainder-only': { const divisor = randomInt(5, 9, random); const quotient = randomInt(1, 9, random); const remainder = randomInt(1, divisor - 1, random); const dividend = divisor * quotient + remainder; return { prompt: `${dividend} ÷ ${divisor}\nあまりはいくつ？`, answer: remainder, hint: `${divisor}のばい数で${dividend}に一番近い数を見つけよう。`, difficulty: 3, presentationType: 'remainder', choiceMin: 0, choiceMax: divisor - 1 } }
    case 'g3-division-remainder-word': {
      const target = wordItem(random); const boxSize = randomInt(3, 8, random); const boxes = randomInt(2, 8, random); const remainder = randomInt(1, boxSize - 1, random); const total = boxSize * boxes + remainder
      return { prompt: `${total}${target.counter}の ${target.name}を\n1箱に ${boxSize}${target.counter}ずつ 入れます。\n箱はいくつできて、いくつあまる？`, answer: `${boxes}箱と ${remainder}${target.counter}あまり`, hint: `${boxSize}ずつのまとまりを作って、のこりを考えよう。`, difficulty: 3, presentationType: 'word-problem', choiceValues: [`${boxes}箱と ${remainder}${target.counter}あまり`, `${boxes + 1}箱と ${remainder}${target.counter}あまり`, `${Math.max(1, boxes - 1)}箱と ${remainder}${target.counter}あまり`, `${boxes}箱と ${remainder === boxSize - 1 ? remainder - 1 : remainder + 1}${target.counter}あまり`] }
    }
    case 'g3-fraction-basic': { const denominator = randomInt(2, 6, random); const item = pick(FRACTION_ITEMS, random); const answer = `1/${denominator}`; return { prompt: `1つの${item}を\n${denominator}つに 同じ大きさで分けました。\n1つ分は？`, answer, hint: `${denominator}こに同じように分けたうちの、1こ分を考えよう。`, difficulty: 1, presentationType: 'fraction', choiceValues: [answer, ...[2, 3, 4, 5, 6].filter((value) => value !== denominator).slice(0, 3).map((value) => `1/${value}`)] } }
  }
  throw new Error(`${problemType}の問題を生成できません。`)
}

function problemPresentation(problemType: QuestionProblemType): QuestionPresentationType {
  if (problemType.endsWith('-time')) return 'clock'
  if (problemType.endsWith('-length')) return 'measurement'
  if (problemType.endsWith('-money')) return 'money'
  if (problemType.endsWith('-number-concept')) return 'number-concept'
  if (problemType.includes('missing')) return 'fill-blank'
  if (problemType.includes('word')) return 'word-problem'
  if (problemType === 'g1-compare') return 'comparison'
  if (problemType === 'g3-division-quotient') return 'quotient'
  if (problemType === 'g3-division-remainder-only') return 'remainder'
  if (problemType === 'g3-fraction-basic') return 'fraction'
  return 'calculation'
}

function createQuestion(grade: Grade, skillId: QuestionSkillId, problemType: QuestionProblemType, random: RandomSource): LearningQuestion {
  const draft = createDraft(problemType, skillId, random)
  const choices = draft.choiceValues ? valueChoices(draft.choiceValues, random) : numericChoices(Number(draft.answer), random, draft.choiceMin, draft.choiceMax)
  return { id: `${problemType}-${draft.prompt.replace(/\s+/g, '')}`, grade, skillId, problemType, presentationType: draft.presentationType, prompt: draft.prompt, correctAnswer: draft.answer, choices, hint: draft.hint, difficulty: draft.difficulty, visual: draft.visual }
}

export function generateQuestionForProblemType(problemType: QuestionProblemType, random: RandomSource = Math.random): LearningQuestion {
  const skillId = DEFAULT_SKILL_BY_PROBLEM_TYPE[problemType]
  return createQuestion(gradeForSkill(skillId), skillId, problemType, random)
}

export function generateQuestion(grade: Grade, skillId: QuestionSkillId, random: RandomSource = Math.random, problemType?: QuestionProblemType): LearningQuestion {
  const candidates = SKILL_PROBLEM_TYPES[skillId]
  const selected = problemType ?? pick(candidates, random)
  if (!candidates.includes(selected)) throw new Error(`${selected}は${skillId}の問題形式ではありません。`)
  return createQuestion(grade, skillId, selected, random)
}

function chooseProblemType(skillId: QuestionSkillId, previous: QuestionPresentationType | null, counts: Map<QuestionPresentationType, number>, random: RandomSource): QuestionProblemType {
  const all = SKILL_PROBLEM_TYPES[skillId]
  const nonRepeating = all.filter((type) => problemPresentation(type) !== previous)
  const candidates = nonRepeating.length > 0 ? nonRepeating : all
  const minimum = Math.min(...candidates.map((type) => counts.get(problemPresentation(type)) ?? 0))
  return pick(candidates.filter((type) => (counts.get(problemPresentation(type)) ?? 0) === minimum), random)
}

export function generateQuestionSession(grade: Grade, count = 10, random: RandomSource = Math.random): LearningQuestion[] {
  const plan = GRADE_SKILL_PLANS[grade]
  return generateQuestionsForSkillPlan(grade, Array.from({ length: count }, (_, index) => plan[index % plan.length]), random)
}

export function generateQuestionsForSkillPlan(grade: Grade, skillIds: readonly QuestionSkillId[], random: RandomSource = Math.random): LearningQuestion[] {
  const questions: LearningQuestion[] = []
  const usedPrompts = new Set<string>()
  const counts = new Map<QuestionPresentationType, number>()
  let previous: QuestionPresentationType | null = null
  for (const skillId of skillIds) {
    const problemType = chooseProblemType(skillId, previous, counts, random)
    let question: LearningQuestion | null = null
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = generateQuestion(grade, skillId, random, problemType)
      if (!usedPrompts.has(candidate.prompt)) { question = candidate; break }
    }
    if (!question) throw new Error('重複しない問題を生成できませんでした。')
    usedPrompts.add(question.prompt)
    questions.push(question)
    previous = question.presentationType ?? 'calculation'
    counts.set(previous, (counts.get(previous) ?? 0) + 1)
  }
  return questions
}

export function getGradeSkillIds(grade: Grade): QuestionSkillId[] { return [...GRADE_SKILL_PLANS[grade]] }
export function getProblemTypesForSkill(skillId: QuestionSkillId): readonly QuestionProblemType[] { return SKILL_PROBLEM_TYPES[skillId] }
export function getPriority8ProblemTypes(): readonly QuestionProblemType[] { return PRIORITY_8_PROBLEM_TYPES }
export function getPriority9ProblemTypes(): readonly QuestionProblemType[] { return PRIORITY_9_PROBLEM_TYPES }
