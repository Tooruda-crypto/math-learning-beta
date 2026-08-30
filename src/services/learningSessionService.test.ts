import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { IndexedDbAppRepository } from '../storage/IndexedDbAppRepository'
import { createDefaultAppData } from '../storage/defaultAppData'
import type { Profile, QuestionResult, SkillProgress } from '../types/app'
import type { AppRepository } from '../repositories/AppRepository'
import { calculateStudyStats } from '../domain/progress/studyHistory'
import {
  calculateSkillProgress,
  createDailySession,
  saveCompletedLearningSession,
} from './learningSessionService'

function result(
  questionId: string,
  skillId: string,
  firstAttemptCorrect: boolean,
  retryCorrect: boolean | null,
  answeredAt: string,
): QuestionResult {
  return {
    questionId,
    skillId,
    question: `${questionId} = ?`,
    correctAnswer: '5',
    selectedAnswer: '5',
    firstAttemptCorrect,
    retryCorrect,
    responseTimeMs: 500,
    answeredAt,
  }
}

describe('learningSessionService', () => {
  it('複数skillIdを独立更新し、再挑戦をattemptsとcorrectCountへ加えない', () => {
    const progress = calculateSkillProgress({}, [
      result('q1', 'add', true, null, '2026-08-28T01:00:00.000Z'),
      result('q2', 'add', false, true, '2026-08-28T01:01:00.000Z'),
      result('q3', 'sub', false, false, '2026-08-28T01:02:00.000Z'),
    ])

    expect(progress).toEqual(expect.arrayContaining([
      expect.objectContaining({
        skillId: 'add', attempts: 2, correctCount: 1,
        recentResults: [true, false], recentAccuracy: 0.5,
        level: 1, lastStudiedAt: '2026-08-28T01:01:00.000Z',
      }),
      expect.objectContaining({
        skillId: 'sub', attempts: 1, correctCount: 0,
        recentResults: [false], recentAccuracy: 0,
        level: 1, lastStudiedAt: '2026-08-28T01:02:00.000Z',
      }),
    ]))
  })

  it('recentResultsを直近10件に制限し、0〜1のrecentAccuracyを再計算する', () => {
    const existing: SkillProgress = {
      skillId: 'add', attempts: 9, correctCount: 9,
      recentResults: Array.from({ length: 9 }, () => true),
      recentAccuracy: 1, level: 3, lastStudiedAt: '2026-08-27T00:00:00.000Z',
    }
    const [progress] = calculateSkillProgress({ add: existing }, [
      result('q10', 'add', false, true, '2026-08-28T01:00:00.000Z'),
      result('q11', 'add', false, false, '2026-08-28T01:01:00.000Z'),
    ])

    expect(progress.recentResults).toHaveLength(10)
    expect(progress.recentResults.filter(Boolean)).toHaveLength(8)
    expect(progress.recentAccuracy).toBe(0.8)
    expect(progress.attempts).toBe(11)
    expect(progress.correctCount).toBe(9)
    expect(progress.level).toBe(3)
    expect(progress.lastStudiedAt).toBe('2026-08-28T01:01:00.000Z')
  })

  it('DailySessionとQuestionResultを保存し、再読込後もProfileと複数進捗を保持する', async () => {
    const indexedDb = new IDBFactory()
    const repository = new IndexedDbAppRepository(indexedDb)
    const profile: Profile = {
      id: 'profile-1', nickname: 'はる', grade: 2,
      createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
    }
    const results = Array.from({ length: 10 }, (_, index) => result(
      `q${index + 1}`,
      index % 2 === 0 ? 'g2-add-two-one' : 'g2-sub-two-one',
      index < 6,
      index < 6 ? null : true,
      `2026-08-28T01:${String(index).padStart(2, '0')}:00.000Z`,
    ))
    await repository.saveProfile(profile)
    await saveCompletedLearningSession(repository, {
      sessionId: 'session-1', grade: 2,
      startedAt: '2026-08-28T00:59:00.000Z', completedAt: '2026-08-28T01:02:00.000Z',
      results,
    })

    const reloaded = await new IndexedDbAppRepository(indexedDb).getAppData()
    expect(reloaded.profile).toEqual(profile)
    expect(reloaded.sessions).toHaveLength(1)
    expect(reloaded.sessions[0]).toMatchObject({
      id: 'session-1', grade: 2, completed: true, score: 6, earnedPoints: 16,
      startedAt: '2026-08-28T00:59:00.000Z', completedAt: '2026-08-28T01:02:00.000Z',
      questions: results,
    })
    expect(Object.keys(reloaded.skillProgress)).toEqual(expect.arrayContaining([
      'g2-add-two-one', 'g2-sub-two-one',
    ]))
    expect(reloaded.rewardState).toMatchObject({ points: 16, level: 1 })
    expect(reloaded.townState.unlockedTownItems).toEqual(['tree'])
  })

  it('再挑戦正解をボーナスへ加えず、完了報酬は必ず付ける', () => {
    const results = Array.from({ length: 10 }, (_, index) => result(
      `q${index}`,
      'add',
      index < 7,
      index >= 7 ? true : null,
      `2026-08-28T01:${String(index).padStart(2, '0')}:00.000Z`,
    ))
    const session = createDailySession({
      sessionId: 'reward-session',
      grade: 1,
      startedAt: '2026-08-28T01:00:00.000Z',
      completedAt: '2026-08-28T01:10:00.000Z',
      results,
    })
    expect(session.score).toBe(7)
    expect(session.earnedPoints).toBe(17)
  })

  it('同じsessionIdの再試行でポイント・進捗・街を二重更新しない', async () => {
    const repository = new IndexedDbAppRepository(new IDBFactory())
    await repository.saveProfile({
      id: 'profile-duplicate', nickname: 'テスト', grade: 1,
      createdAt: '', updatedAt: '',
    })
    const results = Array.from({ length: 10 }, (_, index) => result(
      `q${index}`,
      'add',
      index < 7,
      index >= 7 ? true : null,
      `2026-08-28T01:${String(index).padStart(2, '0')}:00.000Z`,
    ))
    const input = {
      sessionId: 'same-session',
      grade: 1 as const,
      startedAt: '2026-08-28T01:00:00.000Z',
      completedAt: '2026-08-28T01:10:00.000Z',
      results,
    }

    const first = await saveCompletedLearningSession(repository, input)
    await repository.saveInProgressSession({
      sessionId: 'same-session',
      startedAt: input.startedAt,
      grade: 1,
      questions: [],
      currentQuestionIndex: 10,
      results,
    })
    const retry = await saveCompletedLearningSession(repository, input)
    const reloaded = await repository.getAppData()

    expect(first.newlyUnlockedTownItemIds).toEqual(['tree'])
    expect(retry.newlyUnlockedTownItemIds).toEqual([])
    expect(reloaded.sessions).toHaveLength(1)
    expect(reloaded.rewardState.points).toBe(17)
    expect(reloaded.skillProgress.add.attempts).toBe(10)
    expect(reloaded.townState.unlockedTownItems).toEqual(['tree'])
    expect(reloaded.inProgressSession).toBeNull()
  })

  it('同日に別セッションを完了するとポイントだけ加算し、学習日は増やさない', async () => {
    const repository = new IndexedDbAppRepository(new IDBFactory())
    await repository.saveProfile({
      id: 'profile-same-day', nickname: 'テスト', grade: 1,
      createdAt: '', updatedAt: '',
    })
    const results = Array.from({ length: 10 }, (_, index) => result(
      `q${index}`,
      'add',
      true,
      null,
      `2026-08-28T01:${String(index).padStart(2, '0')}:00.000Z`,
    ))
    for (const sessionId of ['morning', 'evening']) {
      await saveCompletedLearningSession(repository, {
        sessionId,
        grade: 1,
        startedAt: '2026-08-28T01:00:00.000Z',
        completedAt: '2026-08-28T01:10:00.000Z',
        results,
      })
    }
    const reloaded = await repository.getAppData()
    expect(reloaded.rewardState.points).toBe(40)
    expect(calculateStudyStats(reloaded.sessions, new Date('2026-08-28T12:00:00')).totalStudyDays).toBe(1)
    expect(reloaded.townState.unlockedTownItems).toEqual(['tree'])
  })

  it('保存失敗時は集約保存を失敗として返し、既存報酬を変更しない', async () => {
    const stored = {
      ...createDefaultAppData(),
      rewardState: { points: 45, level: 1, unlockedItems: ['starter'] },
      townState: { unlockedTownItems: ['tree'] },
    }
    const saveCompletedSession = vi.fn().mockRejectedValue(new Error('save failed'))
    const repository: AppRepository = {
      getAppData: vi.fn().mockResolvedValue(stored),
      saveCompletedSession,
      saveProfile: vi.fn(),
      setActiveProfile: vi.fn(),
      saveInProgressSession: vi.fn(),
      saveSkillProgress: vi.fn(),
      saveSession: vi.fn(),
      saveRewardState: vi.fn(),
      saveTownState: vi.fn(),
      saveSettings: vi.fn(),
    }
    const results = Array.from({ length: 10 }, (_, index) => result(
      `q${index}`,
      'add',
      true,
      null,
      `2026-08-28T01:${String(index).padStart(2, '0')}:00.000Z`,
    ))

    await expect(saveCompletedLearningSession(repository, {
      sessionId: 'failed-session',
      grade: 1,
      startedAt: '2026-08-28T01:00:00.000Z',
      completedAt: '2026-08-28T01:10:00.000Z',
      results,
    })).rejects.toThrow('save failed')

    expect(saveCompletedSession).toHaveBeenCalledTimes(1)
    expect(saveCompletedSession.mock.calls[0][2]).toMatchObject({ points: 65 })
    expect(saveCompletedSession.mock.calls[0][3]).toMatchObject({
      unlockedTownItems: ['tree'],
    })
    expect(stored.rewardState).toEqual({
      points: 45,
      level: 1,
      unlockedItems: ['starter'],
    })
    expect(stored.townState.unlockedTownItems).toEqual(['tree'])
  })
})
