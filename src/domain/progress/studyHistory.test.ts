import { describe, expect, it } from 'vitest'
import type { DailySession, QuestionResult } from '../../types/app'
import { calculateStudyStats, getStudyDateKeys } from './studyHistory'

const questions: QuestionResult[] = Array.from({ length: 10 }, (_, index) => ({
  questionId: `q-${index}`,
  skillId: 'skill',
  question: '1 + 1 = ?',
  correctAnswer: '2',
  selectedAnswer: '2',
  firstAttemptCorrect: true,
  retryCorrect: null,
  responseTimeMs: 100,
  answeredAt: '2026-08-20T10:00:00.000Z',
}))

function session(id: string, date: string): DailySession {
  return {
    id,
    date,
    startedAt: `${date}T10:00:00.000Z`,
    completedAt: `${date}T10:05:00.000Z`,
    grade: 1,
    questions,
    completed: true,
    score: 10,
    earnedPoints: 20,
  }
}

describe('studyHistory', () => {
  it('同日複数セッションを1学習日として数える', () => {
    const sessions = [
      session('a', '2026-08-20'),
      session('b', '2026-08-20'),
      session('c', '2026-08-21'),
      session('d', '2026-08-23'),
    ]
    expect(getStudyDateKeys(sessions)).toEqual([
      '2026-08-20',
      '2026-08-21',
      '2026-08-23',
    ])
    expect(calculateStudyStats(sessions, new Date(2026, 7, 23)).totalStudyDays).toBe(3)
  })

  it('currentStreakと休んでも失われないbestStreakを計算する', () => {
    const sessions = [
      session('a', '2026-08-10'),
      session('b', '2026-08-11'),
      session('c', '2026-08-12'),
      session('d', '2026-08-20'),
      session('e', '2026-08-21'),
      session('f', '2026-08-22'),
      session('g', '2026-08-23'),
      session('h', '2026-08-24'),
    ]
    expect(calculateStudyStats(sessions, new Date(2026, 7, 24))).toMatchObject({
      currentStreak: 5,
      bestStreak: 5,
    })
    expect(calculateStudyStats(sessions, new Date(2026, 7, 27))).toMatchObject({
      currentStreak: 0,
      bestStreak: 5,
    })
  })

  it.each([
    ['今日まで連続', ['2026-08-27', '2026-08-28'], 2],
    ['昨日まで連続', ['2026-08-26', '2026-08-27'], 2],
    ['1日空いた', ['2026-08-25', '2026-08-26'], 0],
  ] as const)('%sのcurrentStreakを実行日によらず判定する', (_label, dates, expected) => {
    const sessions = dates.map((date, index) => session(String(index), date))
    expect(calculateStudyStats(sessions, new Date(2026, 7, 28, 12)).currentStreak)
      .toBe(expected)
  })

  it('月曜始まりの今週7日へ学習済み日を反映する', () => {
    const stats = calculateStudyStats([
      session('monday', '2026-08-24'),
      session('wednesday', '2026-08-26'),
    ], new Date(2026, 7, 26, 12))

    expect(stats.weeklyStudyDays.map((day) => day.label)).toEqual([
      '月', '火', '水', '木', '金', '土', '日',
    ])
    expect(stats.weeklyStudyDays.filter((day) => day.studied).map((day) => day.date)).toEqual([
      '2026-08-24', '2026-08-26',
    ])
    expect(stats.weeklyStudyDays[2].isToday).toBe(true)
  })

  it('未完了または10問未満のセッションを学習日に含めない', () => {
    const incomplete = { ...session('a', '2026-08-20'), completed: false }
    const tooShort = { ...session('b', '2026-08-21'), questions: questions.slice(0, 9) }
    expect(getStudyDateKeys([incomplete, tooShort])).toEqual([])
  })
})
