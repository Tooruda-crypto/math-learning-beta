import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultAppData } from '../storage/defaultAppData'
import type { DailySession, QuestionResult } from '../types/app'
import { ParentProgressPage } from './ParentProgressPage'

const questions: QuestionResult[] = Array.from({ length: 10 }, (_, index) => ({
  questionId: `q-${index}`,
  skillId: 'g2-add-two-one',
  question: '20 + 3 = ?',
  correctAnswer: '23',
  selectedAnswer: '23',
  firstAttemptCorrect: index < 4,
  retryCorrect: index >= 4,
  responseTimeMs: 500,
  answeredAt: '2026-08-28T01:00:00.000Z',
}))

function session(id: string, date: string): DailySession {
  return {
    id,
    date,
    startedAt: `${date}T01:00:00.000Z`,
    completedAt: `${date}T01:05:00.000Z`,
    grade: 2,
    questions,
    completed: true,
    score: 4,
    earnedPoints: 14,
  }
}

describe('ParentProgressPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 28, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('データなしでも内部コードを出さず、全項目を0で表示する', () => {
    const appData = {
      ...createDefaultAppData(),
      profile: {
        id: 'profile-empty', nickname: 'そら', grade: 3 as const,
        createdAt: '', updatedAt: '',
      },
    }
    render(<ParentProgressPage appData={appData} onBack={vi.fn()} />)

    expect(screen.getAllByText('0日')).toHaveLength(4)
    expect(screen.getByText('0回')).toBeVisible()
    expect(screen.getByText('0問', { selector: '.parent-summary strong' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'あまりのある割り算' })).toBeVisible()
    expect(screen.getAllByText('これから学習します')).toHaveLength(10)
    expect(document.body.textContent).not.toMatch(/g[123]-/)
  })

  it('学習概要・単元別正答率・日本語の習得状態を表示する', () => {
    const profile = {
      id: 'profile-1',
      nickname: 'はる',
      grade: 2 as const,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    const appData = {
      ...createDefaultAppData(),
      profile,
      sessions: [session('one', '2026-08-28')],
      rewardState: { points: 64, level: 2, unlockedItems: [] },
      skillProgress: {
        'g2-add-two-one': {
          skillId: 'g2-add-two-one',
          attempts: 10,
          correctCount: 4,
          recentResults: [true, true, true, true, false, false, false, false, false, false],
          recentAccuracy: 0.4,
          level: 1,
          lastStudiedAt: '2026-08-28T01:00:00.000Z',
        },
      },
    }

    render(<ParentProgressPage appData={appData} onBack={vi.fn()} />)

    expect(screen.getAllByText('1日', { selector: '.parent-summary strong' })).toHaveLength(4)
    expect(screen.getByText('1回')).toBeVisible()
    expect(screen.getByText('10問', { selector: '.parent-summary strong' })).toBeVisible()
    expect(screen.getByText('64 pt')).toBeVisible()
    expect(screen.getByRole('heading', { name: '2桁＋1桁' })).toBeVisible()
    expect(screen.getByText('40%')).toBeVisible()
    expect(screen.getByText('もう少し練習すると安心です')).toBeVisible()
    expect(screen.queryByText('FOCUS')).not.toBeInTheDocument()
    expect(appData.profile).toEqual(profile)
  })

  it('大量履歴とMASTEREDを集計し、否定的な文言を表示しない', () => {
    const sessions = Array.from({ length: 12 }, (_, index) => ({
      ...session(`session-${index}`, `2026-08-${String(index + 1).padStart(2, '0')}`),
      grade: ((index % 3) + 1) as 1 | 2 | 3,
    }))
    const appData = {
      ...createDefaultAppData(),
      profile: {
        id: 'profile-mastered', nickname: 'りん', grade: 2 as const,
        createdAt: '', updatedAt: '',
      },
      sessions,
      rewardState: { points: 240, level: 4, unlockedItems: [] },
      skillProgress: {
        'g2-add-two-one': {
          skillId: 'g2-add-two-one', attempts: 20, correctCount: 18,
          recentResults: [true, true, true, true, true, true, true, true, true, false],
          recentAccuracy: 0.9, level: 4, lastStudiedAt: '2026-08-12T01:00:00.000Z',
        },
      },
    }
    render(<ParentProgressPage appData={appData} onBack={vi.fn()} />)

    expect(screen.getByText('12回')).toBeVisible()
    expect(screen.getByText('120問')).toBeVisible()
    expect(screen.getByText('240 pt')).toBeVisible()
    expect(screen.getByText('よく身についています')).toBeVisible()
    expect(document.body.textContent).not.toMatch(/苦手|できない|失敗/)
  })
})
