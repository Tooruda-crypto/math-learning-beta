import type {
  QuestionAnswer,
  QuestionPresentationType,
  QuestionProblemType,
  QuestionSkillId,
  QuestionVisual,
  RandomSource,
} from './types'

export interface Priority9Draft {
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

export const PRIORITY_9_PROBLEM_TYPES = [
  'g1-add-word-varied', 'g1-sub-word-varied',
  'g2-multiplication-word-varied', 'g3-division-word-varied',
  'g1-number-concept', 'g2-number-concept', 'g3-number-concept',
  'g1-time', 'g2-time', 'g3-time',
  'g1-length', 'g2-length', 'g3-length',
  'g1-money', 'g2-money', 'g3-money',
] as const satisfies readonly QuestionProblemType[]

export const PRIORITY_9_SKILL_IDS = [
  'g1-number-concept', 'g1-time', 'g1-length', 'g1-money',
  'g2-number-concept', 'g2-time', 'g2-length', 'g2-money',
  'g3-number-concept', 'g3-time', 'g3-length', 'g3-money',
] as const satisfies readonly QuestionSkillId[]

const ITEMS = [
  ['りんご', 'こ'], ['えんぴつ', 'ほん'], ['シール', 'まい'],
  ['本', 'さつ'], ['お菓子', 'こ'], ['花', '本'], ['ボール', 'こ'],
] as const
const VEHICLES = ['電車', 'バス'] as const
const SHOP_ITEMS = ['ノート', 'えんぴつ', '消しゴム', 'お菓子', 'シール'] as const
const CLOCK_CONTEXTS = ['教室', '学校', '駅', '公園', '図書館', '動物園'] as const

function int(min: number, max: number, random: RandomSource): number {
  return Math.floor(random() * (max - min + 1)) + min
}

function pick<T>(items: readonly T[], random: RandomSource): T {
  return items[int(0, items.length - 1, random)]
}

function four<T extends QuestionAnswer>(answer: T, candidates: readonly T[]): T[] {
  const result = [...new Set<T>([answer, ...candidates])]
  if (result.length < 4) throw new Error('4つの選択肢を作れませんでした。')
  return result.slice(0, 4)
}

function around(answer: number, unit = '', minimum = 0): string[] {
  const step = answer >= 1000 ? 100 : answer >= 100 ? 10 : 1
  const value = (candidate: number) => `${Math.max(minimum, candidate)}${unit}`
  return four(value(answer), [
    value(answer + step), value(answer - step),
    value(answer + step * 2), value(answer + step * 10),
    value(answer - step * 10), value(answer + step * 20),
  ])
}

function timeLabel(totalMinutes: number, withPeriod = false): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(normalized / 60)
  const minute = normalized % 60
  const hour12 = hour24 % 12 || 12
  const clock = `${hour12}時${minute === 0 ? '' : `${minute}分`}`
  return withPeriod ? `${hour24 < 12 ? '午前' : '午後'}${clock}` : clock
}

export function addMinutes(totalMinutes: number, elapsedMinutes: number): number {
  return ((totalMinutes + elapsedMinutes) % 1440 + 1440) % 1440
}

function timeChoices(answerMinutes: number, withPeriod = false): string[] {
  const label = (offset: number) => timeLabel(addMinutes(answerMinutes, offset), withPeriod)
  return four(label(0), [label(30), label(-30), label(60), label(-60)])
}

function wordAddition(random: RandomSource): Priority9Draft {
  const [item, counter] = pick(ITEMS, random)
  const first = int(2, 9, random)
  const second = int(1, 10 - first, random)
  const mode = int(0, 3, random)
  const prompts = [
    `${item}が ${first}${counter}、${item}が ${second}${counter} あります。\nあわせて なん${counter}？`,
    `${item}が ${first}${counter} あります。\nあとから ${second}${counter} ふえました。\nぜんぶで なん${counter}？`,
    `${item}を ${first}${counter} もっています。\n${second}${counter} もらいました。\nいま なん${counter}？`,
    `Aのはこに ${item}が ${first}${counter}、Bのはこに ${second}${counter} あります。\n1つに あつめると なん${counter}？`,
  ]
  return { prompt: prompts[mode], answer: first + second, hint: '2つの数は、あわせるのかな？増えたのかな？', difficulty: 2, presentationType: 'word-problem' }
}

function wordSubtraction(random: RandomSource): Priority9Draft {
  const [item, counter] = pick(ITEMS, random)
  const larger = int(6, 10, random)
  const smaller = int(1, larger - 1, random)
  const difference = larger - smaller
  const mode = int(0, 4, random)
  const prompts = [
    `${item}が ${larger}${counter} あります。\n${smaller}${counter} つかいました。\nのこりは なん${counter}？`,
    `${VEHICLES[mode % VEHICLES.length]}に ${larger}人 のっています。\n${smaller}人 おりました。\nのこりは なん人？`,
    `${item}が Aには ${larger}${counter}、Bには ${smaller}${counter} あります。\nちがいは なん${counter}？`,
    `あかい${item}は ${larger}${counter}、あおい${item}は ${smaller}${counter} です。\nあかい${item}は なん${counter} おおい？`,
    `${smaller}${counter} つかったら、${difference}${counter} のこりました。\nはじめに ${item}は なん${counter} あった？`,
  ]
  return { prompt: prompts[mode], answer: mode === 4 ? larger : difference, hint: mode === 4 ? 'つかった数と、のこった数をあわせてみよう。' : 'へったのかな？2つの数のちがいかな？', difficulty: 2, presentationType: 'word-problem' }
}

function wordMultiplication(skillId: QuestionSkillId, random: RandomSource): Priority9Draft {
  const [item, counter] = pick(ITEMS, random)
  const each = skillId === 'g2-multiplication-6-9' ? int(6, 9, random) : int(2, 5, random)
  const groups = int(2, 9, random)
  const mode = int(0, 5, random)
  const price = each * 10
  const prompts = [
    `1つのグループに ${groups}人ずついます。\n${each}グループでは ぜんぶで 何人？`,
    `${groups}人に ${item}を ${each}${counter}ずつ くばります。\nぜんぶで なん${counter} いる？`,
    `1まいの さらに ${item}が ${each}${counter}ずつあります。\nさらが ${groups}まいでは なん${counter}？`,
    `1ふくろに ${item}が ${each}${counter}ずつ入っています。\n${groups}ふくろでは なん${counter}？`,
    `1れつに ${each}人ずつ、${groups}れつに ならびます。\nぜんぶで 何人？`,
    `${price}円の ${SHOP_ITEMS[groups % SHOP_ITEMS.length]}を ${groups}こ買います。\nぜんぶで 何円？`,
  ]
  const answer = mode === 5 ? price * groups : each * groups
  return { prompt: prompts[mode], answer, hint: '同じ数のまとまりが、いくつ分あるか考えてみよう。', difficulty: 2, presentationType: 'word-problem' }
}

function wordDivision(skillId: QuestionSkillId, random: RandomSource): Priority9Draft {
  const [item, counter] = pick(ITEMS, random)
  const divisor = int(2, 8, random)
  const quotient = int(2, 8, random)
  const hasRemainder = skillId === 'g3-division-remainder'
  const remainder = hasRemainder ? int(1, divisor - 1, random) : 0
  const total = divisor * quotient + remainder
  const mode = hasRemainder ? int(4, 5, random) : int(0, 3, random)
  const prompts = [
    `${total}${counter}の ${item}を ${divisor}人で 同じ数ずつ分けます。\n1人分は なん${counter}？`,
    `${total}${counter}の ${item}を 1人に ${divisor}${counter}ずつくばります。\n何人に くばせる？`,
    `${total}人を ${divisor}人ずつのグループにします。\n何グループ できる？`,
    `${total}${counter}の ${item}を ${quotient}人で 同じ数ずつ分けます。\n1人分は なん${counter}？`,
    `${total}${counter}の ${item}を 1箱に ${divisor}${counter}ずつ入れます。\n何箱できて、いくつあまる？`,
    `${total}${counter}の ${item}を ${divisor}人で 同じ数ずつ分けます。\nあまりは なん${counter}？`,
  ]
  if (mode === 4) {
    const answer = `${quotient}箱と ${remainder}${counter}あまり`
    return { prompt: prompts[mode], answer, hint: `${divisor}ずつのまとまりを作って、のこりを見てみよう。`, difficulty: 3, presentationType: 'word-problem', choiceValues: four(answer, [`${quotient + 1}箱と ${remainder}${counter}あまり`, `${Math.max(1, quotient - 1)}箱と ${remainder}${counter}あまり`, `${quotient}箱と ${remainder + 1}${counter}あまり`]) }
  }
  if (mode === 5) return { prompt: prompts[mode], answer: remainder, hint: '同じ数ずつ分けたあと、のこる数を考えよう。', difficulty: 3, presentationType: 'word-problem', choiceMin: 0, choiceMax: divisor - 1 }
  const answer = mode === 3 ? divisor : quotient
  return { prompt: prompts[mode], answer, hint: '同じ数ずつ分けるのか、いくつのまとまりを作るのか考えよう。', difficulty: 2, presentationType: 'word-problem' }
}

function numberConcept(grade: 1 | 2 | 3, random: RandomSource): Priority9Draft {
  const max = grade === 1 ? 99 : grade === 2 ? 999 : 9999
  const largestStep = grade === 1 ? 10 : grade === 2 ? 100 : 1000
  const number = int(grade === 1 ? 11 : grade === 2 ? 100 : 1000, max - largestStep, random)
  const mode = int(0, 5, random)
  if (mode === 0) return { prompt: `${number}の つぎの数は？`, answer: number + 1, hint: '数を1つだけ先へ進めてみよう。', difficulty: 1, presentationType: 'number-concept' }
  if (mode === 1) return { prompt: `${number}の まえの数は？`, answer: number - 1, hint: '数を1つだけ前へもどしてみよう。', difficulty: 1, presentationType: 'number-concept' }
  if (mode === 2) {
    const place = grade === 1 ? 10 : grade === 2 ? 100 : 1000
    const digit = Math.floor(number / place) % 10
    const placeName = grade === 1 ? '十' : grade === 2 ? '百' : '千'
    return { prompt: `${number}の ${placeName}のくらいの数字は？`, answer: digit, hint: grade === 1 ? '十と一に分けて考えてみよう。' : grade === 2 ? '百・十・一に分けて考えてみよう。' : '千・百・十・一に分けて考えてみよう。', difficulty: 2, presentationType: 'number-concept', choiceMin: 0, choiceMax: 9 }
  }
  if (mode === 3) {
    const ones = number % 10; const tens = Math.floor(number / 10) % 10
    const hundreds = Math.floor(number / 100) % 10; const thousands = Math.floor(number / 1000) % 10
    const answer = grade === 1
      ? `十が${tens}、一が${ones}`
      : grade === 2
        ? `百が${hundreds}、十が${tens}、一が${ones}`
        : `千が${thousands}、百が${hundreds}、十が${tens}、一が${ones}`
    const changed = (value: number, amount: number) => (value + amount) % 10
    const candidates = grade === 1
      ? [`十が${changed(tens, 1)}、一が${ones}`, `十が${changed(tens, 2)}、一が${ones}`, `十が${tens}、一が${changed(ones, 1)}`]
      : grade === 2
        ? [`百が${changed(hundreds, 1)}、十が${tens}、一が${ones}`, `百が${changed(hundreds, 2)}、十が${tens}、一が${ones}`, `百が${hundreds}、十が${changed(tens, 1)}、一が${ones}`]
        : [`千が${changed(thousands, 1)}、百が${hundreds}、十が${tens}、一が${ones}`, `千が${changed(thousands, 2)}、百が${hundreds}、十が${tens}、一が${ones}`, `千が${thousands}、百が${changed(hundreds, 1)}、十が${tens}、一が${ones}`]
    return { prompt: `${number}を くらいごとに分けると？`, answer, hint: grade === 1 ? '十のまとまりと、一の数を見てみよう。' : '大きいくらいから順番に見てみよう。', difficulty: 2, presentationType: 'number-concept', choiceValues: four(answer, candidates) }
  }
  if (mode === 4) {
    const other = Math.max(0, Math.min(max, number + (random() < .5 ? -int(1, largestStep, random) : int(1, largestStep, random))))
    const answer = number > other ? 'Aのほうが大きい' : 'Bのほうが大きい'
    return { prompt: `A：${number}\nB：${other}\nどちらの数が大きい？`, answer, hint: '大きいくらいから、同じ場所の数字をくらべよう。', difficulty: 2, presentationType: 'number-concept', choiceValues: ['Aのほうが大きい', 'Bのほうが大きい', '同じ', 'くらべられない'] }
  }
  const step = grade === 1 ? 10 : grade === 2 ? 100 : 1000
  return { prompt: `数直線で ${number}から ${step}だけ大きい数は？`, answer: number + step, hint: `くらいをそろえて、${step}だけ進めてみよう。`, difficulty: 2, presentationType: 'number-concept' }
}

function clockQuestion(grade: 1 | 2 | 3, random: RandomSource): Priority9Draft {
  if (grade === 1) {
    const hour = int(1, 12, random); const minute = random() < .5 ? 0 : 30
    const answer = timeLabel(hour * 60 + minute)
    return { prompt: `${pick(CLOCK_CONTEXTS, random)}の時計は 何時？`, answer, hint: '短い針を見てから、長い針を見てみよう。', difficulty: 1, presentationType: 'clock', visual: { type: 'analog-clock', hour, minute }, choiceValues: timeChoices(hour * 60 + minute) }
  }
  if (grade === 2) {
    const mode = int(0, 2, random); const start = int(1, 11, random) * 60 + int(0, 11, random) * 5
    if (mode === 0) return { prompt: `${pick(CLOCK_CONTEXTS, random)}の時計は 何時何分？`, answer: timeLabel(start), hint: '短い針と長い針を順番に見てみよう。', difficulty: 2, presentationType: 'clock', visual: { type: 'analog-clock', hour: Math.floor(start / 60), minute: start % 60 }, choiceValues: timeChoices(start) }
    const elapsed = mode === 1 ? 30 : 60; const answerAt = addMinutes(start, elapsed)
    return { prompt: `${timeLabel(start)}の ${elapsed === 30 ? '30分' : '1時間'}後は？`, answer: timeLabel(answerAt), hint: '時計の分を先に進めて、60分で1時間になることを思い出そう。', difficulty: 2, presentationType: 'clock', choiceValues: timeChoices(answerAt) }
  }
  const mode = int(0, 2, random); const start = int(7, 18, random) * 60 + int(0, 3, random) * 15
  const elapsed = pick([30, 45, 60, 90, 120] as const, random); const end = addMinutes(start, elapsed)
  if (mode === 0) return { prompt: `${timeLabel(start, true)}から ${elapsed}分後は？`, answer: timeLabel(end, true), hint: '分をたして、60分をこえたら1時間くり上げよう。', difficulty: 3, presentationType: 'clock', choiceValues: timeChoices(end, true) }
  if (mode === 1) return { prompt: `${timeLabel(start, true)}に始まり、${timeLabel(end, true)}に終わりました。\n何分かかった？`, answer: `${elapsed}分`, hint: '始めから終わりまで、時間と分を順に数えてみよう。', difficulty: 3, presentationType: 'clock', choiceValues: four(`${elapsed}分`, [`${Math.max(15, elapsed - 30)}分`, `${elapsed + 30}分`, `${elapsed + 60}分`]) }
  return { prompt: `${timeLabel(start, true)}から ${timeLabel(end, true)}までの時間は？`, answer: `${elapsed}分`, hint: '午前・午後を確かめ、60分を1時間として考えよう。', difficulty: 3, presentationType: 'clock', choiceValues: four(`${elapsed}分`, [`${Math.max(15, elapsed - 15)}分`, `${elapsed + 15}分`, `${elapsed + 60}分`]) }
}

function lengthQuestion(grade: 1 | 2 | 3, random: RandomSource): Priority9Draft {
  if (grade === 1) {
    const a = int(2, 15, random); const b = a + int(1, 6, random)
    const answer = random() < .5 ? 'Bのほうが長い' : 'Aのほうが短い'
    return { prompt: `Aのテープは ${a}cm、Bのテープは ${b}cmです。\n正しいのは どれ？`, answer, hint: '2つの数をくらべて、長い・短いを考えよう。', difficulty: 1, presentationType: 'measurement', choiceValues: four(answer, ['Aのほうが長い', 'Bのほうが短い', '同じ長さ', answer === 'Bのほうが長い' ? 'Aのほうが短い' : 'Bのほうが長い']) }
  }
  if (grade === 2) {
    const mode = int(0, 2, random)
    if (mode === 0) { const a = int(10, 70, random); const b = int(5, 100 - a, random); return { prompt: `${a}cmのテープと ${b}cmのテープをつなぎます。\n全部で 何cm？`, answer: `${a + b}cm`, hint: '単位が同じか確認して、長さをたしてみよう。', difficulty: 2, presentationType: 'measurement', choiceValues: around(a + b, 'cm') } }
    if (mode === 1) { const total = int(40, 100, random); const cut = int(5, total - 10, random); return { prompt: `${total}cmのひもから ${cut}cm切りました。\nのこりは 何cm？`, answer: `${total - cut}cm`, hint: '単位をそろえて、切った長さをひいてみよう。', difficulty: 2, presentationType: 'measurement', choiceValues: around(total - cut, 'cm') } }
    return { prompt: '1mは 何cm？', answer: '100cm', hint: 'mとcmの関係を思い出してみよう。', difficulty: 1, presentationType: 'measurement', choiceValues: ['100cm', '10cm', '1000cm', '1cm'] }
  }
  const mode = int(0, 2, random)
  if (mode === 0) { const km = int(1, 9, random); return { prompt: `${km}kmは 何m？`, answer: `${km * 1000}m`, hint: '1kmが何mかを思い出そう。', difficulty: 2, presentationType: 'measurement', choiceValues: four(`${km * 1000}m`, [`${km * 100}m`, `${km * 10}m`, `${km}m`]) } }
  if (mode === 1) { const meters = int(2, 9, random) * 1000; return { prompt: `${meters}mは 何km？`, answer: `${meters / 1000}km`, hint: '1000mごとに1kmのまとまりを作ろう。', difficulty: 2, presentationType: 'measurement', choiceValues: four(`${meters / 1000}km`, [`${meters / 100}km`, `${meters / 10}km`, `${meters}km`]) } }
  const km = int(1, 8, random); const difference = random() < .5 ? int(-400, -1, random) : int(1, 400, random); const meters = km * 1000 + difference; const answer = km * 1000 > meters ? `${km}kmのほうが長い` : `${meters}mのほうが長い`
  return { prompt: `${km}kmと ${meters}mでは、どちらが長い？`, answer, hint: 'kmとmを同じ単位に直してくらべよう。', difficulty: 3, presentationType: 'measurement', choiceValues: [`${km}kmのほうが長い`, `${meters}mのほうが長い`, '同じ長さ', '単位がちがうのでくらべられない'] }
}

function moneyQuestion(grade: 1 | 2 | 3, random: RandomSource): Priority9Draft {
  if (grade === 1) {
    const tens = int(1, 5, random); const ones = int(0, 4, random); const total = tens * 10 + ones
    const mode = int(0, 1, random)
    if (mode === 0) return { prompt: `10円玉が ${tens}まい、1円玉が ${ones}まいあります。\nぜんぶで 何円？`, answer: `${total}円`, hint: '10円のまとまりと1円を、あわせてみよう。', difficulty: 1, presentationType: 'money', choiceValues: around(total, '円') }
    const price = int(1, total, random); return { prompt: `${total}円もっています。\n${price}円の ${SHOP_ITEMS[price % SHOP_ITEMS.length]}を買うと、のこりは何円？`, answer: `${total - price}円`, hint: 'もっているお金から、商品のねだんをひいてみよう。', difficulty: 2, presentationType: 'money', choiceValues: around(total - price, '円') }
  }
  if (grade === 2) {
    const first = int(30, 200, random); const second = int(20, 150, random); const total = first + second; const mode = int(0, 1, random)
    if (mode === 0) return { prompt: `${first}円の ${SHOP_ITEMS[0]}と、${second}円の ${SHOP_ITEMS[2]}を買います。\nぜんぶで 何円？`, answer: `${total}円`, hint: '2つの商品のねだんをたしてみよう。', difficulty: 2, presentationType: 'money', choiceValues: around(total, '円') }
    const paid = Math.ceil(total / 100) * 100 + 100; return { prompt: `${first}円と ${second}円の商品を買い、${paid}円はらいました。\nおつりは 何円？`, answer: `${paid - total}円`, hint: 'まず全部で何円か考えて、はらったお金からひこう。', difficulty: 2, presentationType: 'money', choiceValues: around(paid - total, '円') }
  }
  const price = int(20, 120, random) * 10; const count = int(2, 4, random); const other = int(10, 80, random) * 10; const total = price * count + other; const mode = int(0, 2, random)
  if (mode === 0) return { prompt: `${price}円の ${SHOP_ITEMS[1]}を ${count}本と、${other}円の ${SHOP_ITEMS[0]}を買います。\n合計は 何円？`, answer: `${total}円`, hint: '同じ商品のねだんをかけ算してから、もう1つのねだんをたそう。', difficulty: 3, presentationType: 'money', choiceValues: around(total, '円') }
  const paid = Math.ceil(total / 1000) * 1000 + 1000
  if (mode === 1) return { prompt: `${paid}円もっています。\n${total}円の買い物をすると、のこりは 何円？`, answer: `${paid - total}円`, hint: '所持金から、買い物の合計をひいてみよう。', difficulty: 3, presentationType: 'money', choiceValues: around(paid - total, '円') }
  return { prompt: `${price}円の品を ${count}こ買い、${paid}円はらいます。\nおつりは 何円？`, answer: `${paid - price * count}円`, hint: 'まず全部で何円か考えて、はらったお金からひこう。', difficulty: 3, presentationType: 'money', choiceValues: around(paid - price * count, '円') }
}

export function createPriority9Draft(
  problemType: QuestionProblemType,
  skillId: QuestionSkillId,
  random: RandomSource,
): Priority9Draft | null {
  switch (problemType) {
    case 'g1-add-word-varied': return wordAddition(random)
    case 'g1-sub-word-varied': return wordSubtraction(random)
    case 'g2-multiplication-word-varied': return wordMultiplication(skillId, random)
    case 'g3-division-word-varied': return wordDivision(skillId, random)
    case 'g1-number-concept': return numberConcept(1, random)
    case 'g2-number-concept': return numberConcept(2, random)
    case 'g3-number-concept': return numberConcept(3, random)
    case 'g1-time': return clockQuestion(1, random)
    case 'g2-time': return clockQuestion(2, random)
    case 'g3-time': return clockQuestion(3, random)
    case 'g1-length': return lengthQuestion(1, random)
    case 'g2-length': return lengthQuestion(2, random)
    case 'g3-length': return lengthQuestion(3, random)
    case 'g1-money': return moneyQuestion(1, random)
    case 'g2-money': return moneyQuestion(2, random)
    case 'g3-money': return moneyQuestion(3, random)
    default: return null
  }
}
