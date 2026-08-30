import { describe, expect, it } from 'vitest'
import { migrateAppData } from './defaultAppData'

describe('migrateAppData', () => {
  it('schemaVersion 1のデータを破棄せずVersion 3へ補完する', () => {
    const migrated = migrateAppData({
      schemaVersion: 1,
      profile: {
        id: 'profile-1', nickname: 'はる', grade: 2,
        createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-26T00:00:00.000Z',
      },
      skillProgress: {},
      sessions: [{
        id: 'legacy-session', date: '2026-08-26', completed: true, score: 1, earnedPoints: 0,
        questions: [{
          questionId: 'q1', skillId: 'add', question: '1 + 1 = ?', correctAnswer: '2',
          selectedAnswer: '2', firstAttemptCorrect: true, retryCorrect: null,
          responseTimeMs: 300, answeredAt: '2026-08-26T01:00:00.000Z',
        }],
      }],
      rewardState: { points: 0, level: 1, unlockedItems: [] },
      townState: { unlockedTownItems: [] },
      settings: { dailyQuestionCount: 10, hintsEnabled: true },
    })

    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.inProgressSession).toBeNull()
    expect(migrated.profile?.nickname).toBe('はる')
    expect(migrated.sessions[0]).toMatchObject({
      id: 'legacy-session', grade: 2,
      startedAt: '2026-08-26T01:00:00.000Z',
      completedAt: '2026-08-26T01:00:00.000Z',
    })
  })

  it('schemaVersion 2から3へ移行し、保存ポイントに合わせて全体levelを補正する', () => {
    const migrated = migrateAppData({
      schemaVersion: 2,
      profile: null,
      skillProgress: {},
      sessions: [],
      rewardState: { points: 120, level: 1, unlockedItems: ['starter'] },
      townState: { unlockedTownItems: ['tree'] },
      settings: { dailyQuestionCount: 10, hintsEnabled: true },
    })

    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.rewardState).toEqual({
      points: 120,
      level: 3,
      unlockedItems: ['starter'],
    })
    expect(migrated.townState.unlockedTownItems).toEqual(['tree'])
  })

  it('既存の完了履歴から未反映の街アイテムを安全に補完する', () => {
    const questions = Array.from({ length: 10 }, (_, index) => ({
      questionId: `q-${index}`,
      skillId: 'add',
      question: '1 + 1 = ?',
      correctAnswer: '2',
      selectedAnswer: '2',
      firstAttemptCorrect: true,
      retryCorrect: null,
      responseTimeMs: 100,
      answeredAt: '2026-08-26T01:00:00.000Z',
    }))
    const migrated = migrateAppData({
      schemaVersion: 2,
      sessions: [{
        id: 'priority-3-session',
        date: '2026-08-26',
        startedAt: '2026-08-26T01:00:00.000Z',
        completedAt: '2026-08-26T01:05:00.000Z',
        grade: 1,
        questions,
        completed: true,
        score: 10,
        earnedPoints: 0,
      }],
      townState: { unlockedTownItems: [] },
    })

    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.townState.unlockedTownItems).toEqual(['tree'])
  })
})
