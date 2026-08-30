import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import { QuestionPage } from './QuestionPage'
import { ResultPage } from './ResultPage'
import type { LearningQuestion } from '../domain/questions/types'
import type { QuestionResult } from '../types/app'

const question: LearningQuestion = {
  id: 'test', grade: 1, skillId: 'g1-add-with-carry', prompt: '8 + 7 = ?', correctAnswer: 15,
  choices: [13, 14, 15, 16].map((value) => ({ id: String(value), label: String(value), value })),
  hint: '8に2をたすと10だね。', difficulty: 2,
}

const result: QuestionResult = {
  questionId: 'test', skillId: 'g1-add-with-carry', question: '8 + 7 = ?', correctAnswer: '15',
  selectedAnswer: '15', firstAttemptCorrect: true, retryCorrect: null, responseTimeMs: 500, answeredAt: '',
}

describe('Priority 0 page skeletons', () => {
  it('ホーム画面の主導線を表示する', () => {
    render(<HomePage profile={{ id: '1', nickname: 'はる', grade: 2, createdAt: '', updatedAt: '' }} rewardState={{ level: 1, points: 0, unlockedItems: [] }} townState={{ unlockedTownItems: [] }} sessions={[]} skillProgress={{}} inProgressSession={null} startError={false} isStarting={false} onStart={vi.fn()} onResume={vi.fn()} onParent={vi.fn()} onSwitchProfile={vi.fn()} />)
    expect(screen.getByRole('button', { name: '今日の算数をはじめる' })).toBeVisible()
  })

  it('問題を表示する', () => {
    render(<QuestionPage questions={[question]} onComplete={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '8 + 7 = ?' })).toBeVisible()
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(4)
  })

  it('結果画面を表示する', () => {
    render(<ResultPage results={Array.from({ length: 10 }, (_, index) => ({ ...result, questionId: String(index) }))} earnedPoints={20} newlyUnlockedTownItemIds={['tree']} onTown={vi.fn()} onFinish={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '今日もできた！' })).toBeVisible()
    expect(screen.getAllByText('10')).toHaveLength(2)
    expect(screen.getByText('はじめに正解')).toBeVisible()
    expect(screen.getByText('+20')).toBeVisible()
    expect(screen.getByText('宇宙の町に新しい施設が増えたよ')).toBeVisible()
  })
})
