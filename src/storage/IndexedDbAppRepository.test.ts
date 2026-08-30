import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import type {
  DailySession,
  InProgressSession,
  Profile,
  QuestionResult,
  SkillProgress,
} from '../types/app'
import { IndexedDbAppRepository } from './IndexedDbAppRepository'

describe('IndexedDbAppRepository', () => {
  let indexedDb: IDBFactory

  beforeEach(() => {
    indexedDb = new IDBFactory()
  })

  async function activateProfile(repository: IndexedDbAppRepository) {
    await repository.saveProfile({
      id: 'active-profile', nickname: 'テスト', grade: 1,
      createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
    })
  }

  it('初回設定のプロフィールを保存し、別インスタンスから再読込できる', async () => {
    const profile: Profile = {
      id: 'profile-1', nickname: 'はる', grade: 2,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-26T00:00:00.000Z',
    }
    await new IndexedDbAppRepository(indexedDb).saveProfile(profile)
    const reloadedData = await new IndexedDbAppRepository(indexedDb).getAppData()
    expect(reloadedData.profile).toEqual(profile)
    expect(reloadedData.schemaVersion).toBe(4)
  })

  it('同じsessionIdを二重保存せず、SkillProgressも二重更新しない', async () => {
    const repository = new IndexedDbAppRepository(indexedDb)
    await activateProfile(repository)
    const session: DailySession = {
      id: 'session-1', date: '2026-08-28', grade: 1,
      startedAt: '2026-08-28T00:00:00.000Z', completedAt: '2026-08-28T00:05:00.000Z',
      questions: [], completed: true, score: 0, earnedPoints: 0,
    }
    const progress: SkillProgress = {
      skillId: 'add', attempts: 1, correctCount: 1, recentResults: [true],
      recentAccuracy: 1, level: 1, lastStudiedAt: '2026-08-28T00:04:00.000Z',
    }
    await repository.saveCompletedSession(
      session,
      [progress],
      { points: 17, level: 1, unlockedItems: [] },
      { unlockedTownItems: ['tree'] },
    )
    await repository.saveCompletedSession(
      session,
      [{ ...progress, attempts: 99 }],
      { points: 999, level: 9, unlockedItems: [] },
      { unlockedTownItems: ['tree', 'flowers'] },
    )

    const reloaded = await repository.getAppData()
    expect(reloaded.sessions).toHaveLength(1)
    expect(reloaded.skillProgress.add.attempts).toBe(1)
    expect(reloaded.rewardState.points).toBe(17)
    expect(reloaded.townState.unlockedTownItems).toEqual(['tree'])
  })

  it('途中セッションを保存・再読込し、報酬や進捗を更新しない', async () => {
    const repository = new IndexedDbAppRepository(indexedDb)
    await activateProfile(repository)
    const inProgressSession: InProgressSession = {
      sessionId: 'in-progress-1',
      startedAt: '2026-08-28T00:00:00.000Z',
      grade: 1,
      questions: Array.from({ length: 10 }, (_, index) => ({
        id: `q-${index}`,
        grade: 1 as const,
        skillId: 'g1-add-within-10',
        prompt: '1 + 1 = ?',
        correctAnswer: 2,
        choices: [1, 2, 3, 4].map((value) => ({
          id: String(value), label: String(value), value,
        })),
        hint: '1から1こ先を数えてみよう。',
        difficulty: 1 as const,
      })),
      currentQuestionIndex: 3,
      results: Array.from({ length: 3 }, (_, index): QuestionResult => ({
        questionId: `q-${index}`,
        skillId: 'g1-add-within-10',
        question: '1 + 1 = ?',
        correctAnswer: '2',
        selectedAnswer: '2',
        firstAttemptCorrect: true,
        retryCorrect: null,
        responseTimeMs: 100,
        answeredAt: '2026-08-28T00:01:00.000Z',
      })),
    }

    await repository.saveInProgressSession(inProgressSession)
    const reloaded = await new IndexedDbAppRepository(indexedDb).getAppData()

    expect(reloaded.inProgressSession).toEqual(inProgressSession)
    expect(reloaded.sessions).toEqual([])
    expect(reloaded.skillProgress).toEqual({})
    expect(reloaded.rewardState.points).toBe(0)
  })

  it('完了保存と同じトランザクションで該当する途中データを削除する', async () => {
    const repository = new IndexedDbAppRepository(indexedDb)
    await activateProfile(repository)
    await repository.saveInProgressSession({
      sessionId: 'finish-me',
      startedAt: '2026-08-28T00:00:00.000Z',
      grade: 1,
      questions: [],
      currentQuestionIndex: 0,
      results: [],
    })
    await repository.saveCompletedSession({
      id: 'finish-me',
      date: '2026-08-28',
      startedAt: '2026-08-28T00:00:00.000Z',
      completedAt: '2026-08-28T00:05:00.000Z',
      grade: 1,
      questions: [],
      completed: true,
      score: 0,
      earnedPoints: 10,
    }, [])

    expect((await repository.getAppData()).inProgressSession).toBeNull()
  })

  it('完了保存時は不整合な古い途中データも同じトランザクションで削除する', async () => {
    const repository = new IndexedDbAppRepository(indexedDb)
    await activateProfile(repository)
    await repository.saveInProgressSession({
      sessionId: 'stale-session',
      startedAt: '2026-08-28T00:00:00.000Z',
      grade: 1,
      questions: [],
      currentQuestionIndex: 10,
      results: [],
    })
    await repository.saveCompletedSession({
      id: 'completed-session',
      date: '2026-08-28',
      startedAt: '2026-08-28T00:00:00.000Z',
      completedAt: '2026-08-28T00:05:00.000Z',
      grade: 1,
      questions: [],
      completed: true,
      score: 0,
      earnedPoints: 10,
    }, [])

    expect((await repository.getAppData()).inProgressSession).toBeNull()
  })

  it('保存失敗をAppRepositoryErrorとして呼び出し側へ返す', async () => {
    const brokenIndexedDb = { open: () => { throw new Error('storage unavailable') } } as unknown as IDBFactory
    const repository = new IndexedDbAppRepository(brokenIndexedDb)
    await expect(repository.saveProfile({
      id: 'profile-1', nickname: 'そら', grade: 1,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-26T00:00:00.000Z',
    })).rejects.toMatchObject({ name: 'AppRepositoryError', operation: 'saveProfile' })
  })

  it('完了セッション保存失敗も呼び出し側へ返す', async () => {
    const brokenIndexedDb = { open: () => { throw new Error('storage unavailable') } } as unknown as IDBFactory
    const repository = new IndexedDbAppRepository(brokenIndexedDb)
    await expect(repository.saveCompletedSession({
      id: 'session-1', date: '2026-08-28', grade: 1,
      startedAt: '2026-08-28T00:00:00.000Z', completedAt: '2026-08-28T00:05:00.000Z',
      questions: [], completed: true, score: 0, earnedPoints: 0,
    }, [])).rejects.toMatchObject({ name: 'AppRepositoryError', operation: 'saveCompletedSession' })
  })
})
