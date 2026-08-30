import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { generateQuestionSession } from '../domain/questions/generator'
import type { LearningQuestion, RandomSource } from '../domain/questions/types'
import { QuestionPage } from './QuestionPage'

function testQuestion(id = 'test-1'): LearningQuestion {
  return {
    id,
    grade: 1,
    skillId: 'g1-add-within-10',
    prompt: '3 + 2 = ?',
    correctAnswer: 5,
    choices: [1, 4, 5, 6].map((value) => ({ id: String(value), label: String(value), value })),
    hint: '3から、2こ先を数えてみよう。',
    difficulty: 1,
  }
}

function seededRandom(seed = 123): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

describe('QuestionPage answer flow', () => {
  it('初回正解を記録し、responseTimeMsを保持する', async () => {
    let time = 1000
    const onComplete = vi.fn()
    render(<QuestionPage questions={[testQuestion()]} onComplete={onComplete} now={() => time} />)
    time = 1450
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
    expect(screen.getByText('せいかい！')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'けっかをみる' }))

    expect(onComplete).toHaveBeenCalledWith([
      expect.objectContaining({
        questionId: 'test-1',
        selectedAnswer: '5',
        firstAttemptCorrect: true,
        retryCorrect: null,
        responseTimeMs: 450,
      }),
    ])
  })

  it('初回不正解の後だけ再挑戦し、ヒントと再挑戦正解を記録する', async () => {
    let time = 2000
    const onComplete = vi.fn()
    render(<QuestionPage questions={[testQuestion()]} onComplete={onComplete} now={() => time} />)
    time = 2300
    await userEvent.click(screen.getByRole('button', { name: '4' }))
    await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
    expect(screen.getByText('もういちど考えてみよう')).toBeVisible()
    expect(screen.getByText('3から、2こ先を数えてみよう。')).toBeVisible()

    time = 3000
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
    expect(screen.getByText('せいかい！')).toBeVisible()
    expect(screen.getByRole('button', { name: '4' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'けっかをみる' }))

    expect(onComplete).toHaveBeenCalledWith([
      expect.objectContaining({
        selectedAnswer: '5',
        firstAttemptCorrect: false,
        retryCorrect: true,
        responseTimeMs: 300,
      }),
    ])
  })

  it('再挑戦も不正解ならそこで回答を確定する', async () => {
    const onComplete = vi.fn()
    render(<QuestionPage questions={[testQuestion()]} onComplete={onComplete} now={() => 1000} />)
    await userEvent.click(screen.getByRole('button', { name: '4' }))
    await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
    await userEvent.click(screen.getByRole('button', { name: '6' }))
    await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
    expect(screen.getByText('こたえは 5 だよ')).toBeVisible()
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'けっかをみる' }))
    expect(onComplete).toHaveBeenCalledWith([
      expect.objectContaining({ firstAttemptCorrect: false, retryCorrect: false }),
    ])
  })

  it('10問に回答するとセッションを終了する', async () => {
    const questions = generateQuestionSession(3, 10, seededRandom())
    const onComplete = vi.fn()
    render(<QuestionPage questions={questions} onComplete={onComplete} now={() => 1000} />)

    for (let index = 0; index < questions.length; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: String(questions[index].correctAnswer) }))
      await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
      const nextButtonName = index === questions.length - 1 ? 'けっかをみる' : 'つぎのもんだい'
      await userEvent.click(screen.getByRole('button', { name: nextButtonName }))
    }

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete.mock.calls[0][0]).toHaveLength(10)
  })

  it('あまりのある割り算を文字列回答で正誤判定する', async () => {
    const question: LearningQuestion = {
      id: 'remainder',
      grade: 3,
      skillId: 'g3-division-remainder',
      prompt: '17 ÷ 5 = ?',
      correctAnswer: '3 あまり 2',
      choices: ['2 あまり 2', '3 あまり 1', '3 あまり 2', '4 あまり 2']
        .map((value) => ({ id: value, label: value, value })),
      hint: '5を3回たすと15だね。17まであといくつかな？',
      difficulty: 3,
    }
    const onComplete = vi.fn()
    render(<QuestionPage questions={[question]} onComplete={onComplete} />)

    await userEvent.click(screen.getByRole('button', { name: '3 あまり 2' }))
    await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
    expect(await screen.findByText('せいかい！')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'けっかをみる' }))

    expect(onComplete).toHaveBeenCalledWith([
      expect.objectContaining({
        correctAnswer: '3 あまり 2',
        selectedAnswer: '3 あまり 2',
        firstAttemptCorrect: true,
      }),
    ])
  })

  it('確定回答を保存してから次へ進み、指定問題番号から再開する', async () => {
    const questions = [testQuestion('q1'), testQuestion('q2')]
    const savedResult = {
      questionId: 'q1',
      skillId: 'g1-add-within-10',
      question: '3 + 2 = ?',
      correctAnswer: '5',
      selectedAnswer: '5',
      firstAttemptCorrect: true,
      retryCorrect: null,
      responseTimeMs: 100,
      answeredAt: '2026-08-28T00:00:00.000Z',
    }
    const onProgress = vi.fn().mockResolvedValue(undefined)
    render(
      <QuestionPage
        questions={questions}
        initialQuestionIndex={1}
        initialResults={[savedResult]}
        onProgress={onProgress}
        onComplete={vi.fn()}
      />,
    )

    expect(screen.getByText('2', { selector: '.learning-count strong' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
    expect(onProgress).toHaveBeenCalledWith(
      2,
      expect.arrayContaining([savedResult, expect.objectContaining({ questionId: 'q2' })]),
    )
  })
})
