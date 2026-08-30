import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { LearningQuestion } from '../domain/questions/types'
import { IndexedDbAppRepository } from '../storage/IndexedDbAppRepository'
import { migrateAppData } from '../storage/defaultAppData'
import type { DailySession, InProgressSession, Profile, QuestionResult } from '../types/app'
import { QuestionPage } from '../pages/QuestionPage'
import spaceCss from '../space.css?raw'

function profile(id: string, nickname: string, grade: 1 | 2 | 3): Profile {
  return {
    id, nickname, grade,
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  }
}

function storedQuestion(id: string, grade: 1 | 2 | 3): LearningQuestion {
  return {
    id,
    grade,
    skillId: grade === 1 ? 'g1-add-within-10' : 'g3-multiply-two-one',
    prompt: '1 + 1 = ?',
    correctAnswer: 2,
    choices: [1, 2, 3, 4].map((value) => ({ id: String(value), label: String(value), value })),
    hint: '1こ先を数えてみよう。',
    difficulty: 1,
  }
}

function answerResult(index: number, skillId = 'g1-add-within-10'): QuestionResult {
  return {
    questionId: `q-${index}`,
    skillId,
    question: '1 + 1 = ?',
    correctAnswer: '2',
    selectedAnswer: '2',
    firstAttemptCorrect: true,
    retryCorrect: null,
    responseTimeMs: 100,
    answeredAt: '2026-08-29T00:01:00.000Z',
  }
}

function pending(profileGrade: 1 | 2 | 3, count: number): InProgressSession {
  return {
    sessionId: `pending-${profileGrade}`,
    startedAt: '2026-08-29T00:00:00.000Z',
    grade: profileGrade,
    questions: Array.from({ length: 10 }, (_, index) => storedQuestion(`q-${index}`, profileGrade)),
    currentQuestionIndex: count,
    results: Array.from({ length: count }, (_, index) => answerResult(index)),
  }
}

function completedSession(id: string, grade: 1 | 2 | 3): DailySession {
  return {
    id,
    date: '2026-08-29',
    startedAt: '2026-08-29T00:00:00.000Z',
    completedAt: '2026-08-29T00:10:00.000Z',
    grade,
    questions: Array.from({ length: 10 }, (_, index) => answerResult(index)),
    completed: true,
    score: 10,
    earnedPoints: 20,
  }
}

describe('Priority 7 schemaVersion 4', () => {
  it('Version 3の単一プロフィールと全学習データを1つのprofileIdへ移行する', () => {
    const legacyProfile = profile('legacy-child', 'たろう', 3)
    const migrated = migrateAppData({
      schemaVersion: 3,
      profile: legacyProfile,
      skillProgress: {
        multiply: {
          skillId: 'multiply', attempts: 10, correctCount: 8,
          recentResults: [true, true, true, true, true, true, true, true, false, false],
          recentAccuracy: 0.8, level: 2, lastStudiedAt: '2026-08-29T00:00:00.000Z',
        },
      },
      sessions: [completedSession('legacy-session', 3)],
      inProgressSession: pending(3, 3),
      rewardState: { points: 77, level: 1, unlockedItems: ['starter'] },
      townState: { unlockedTownItems: ['tree', 'flowers'] },
      settings: { dailyQuestionCount: 10, hintsEnabled: true },
    })

    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.profiles).toEqual([legacyProfile])
    expect(migrated.activeProfileId).toBe(legacyProfile.id)
    expect(migrated.profileData[legacyProfile.id]).toMatchObject({
      sessions: [expect.objectContaining({ id: 'legacy-session' })],
      inProgressSession: expect.objectContaining({ currentQuestionIndex: 3 }),
      rewardState: { points: 77, level: 2, unlockedItems: ['starter'] },
      townState: { unlockedTownItems: ['tree', 'flowers'] },
    })
    expect(migrated.profileData[legacyProfile.id].skillProgress.multiply.attempts).toBe(10)
  })

  it('兄弟の進捗・履歴・ポイント・街・途中位置を完全分離する', async () => {
    const repository = new IndexedDbAppRepository(new IDBFactory())
    const older = profile('older', 'たろう', 3)
    const younger = profile('younger', 'はな', 1)

    await repository.saveProfile(older)
    await repository.saveSkillProgress({
      skillId: 'g3-multiply-two-one', attempts: 12, correctCount: 9,
      recentResults: [true, true, true, true, true, true, true, false, false, false],
      recentAccuracy: 0.7, level: 2, lastStudiedAt: '2026-08-29T00:00:00.000Z',
    })
    await repository.saveSession(completedSession('older-session', 3))
    await repository.saveRewardState({ points: 88, level: 2, unlockedItems: [] })
    await repository.saveTownState({ unlockedTownItems: ['tree', 'flowers', 'bench'] })
    await repository.saveInProgressSession(pending(3, 3))

    await repository.saveProfile(younger)
    await repository.saveSkillProgress({
      skillId: 'g1-add-within-10', attempts: 5, correctCount: 5,
      recentResults: [true, true, true, true, true], recentAccuracy: 1,
      level: 1, lastStudiedAt: '2026-08-29T00:00:00.000Z',
    })
    await repository.saveRewardState({ points: 15, level: 1, unlockedItems: [] })
    await repository.saveTownState({ unlockedTownItems: ['tree'] })
    await repository.saveInProgressSession(pending(1, 5))

    await repository.setActiveProfile(older.id)
    const olderData = await repository.getAppData()
    expect(olderData.profile?.nickname).toBe('たろう')
    expect(olderData.rewardState.points).toBe(88)
    expect(olderData.skillProgress['g3-multiply-two-one'].attempts).toBe(12)
    expect(olderData.sessions).toHaveLength(1)
    expect(olderData.townState.unlockedTownItems).toEqual(['tree', 'flowers', 'bench'])
    expect(olderData.inProgressSession?.currentQuestionIndex).toBe(3)

    await repository.setActiveProfile(younger.id)
    const youngerData = await repository.getAppData()
    expect(youngerData.profile?.nickname).toBe('はな')
    expect(youngerData.rewardState.points).toBe(15)
    expect(youngerData.skillProgress['g1-add-within-10'].attempts).toBe(5)
    expect(youngerData.skillProgress['g3-multiply-two-one']).toBeUndefined()
    expect(youngerData.sessions).toEqual([])
    expect(youngerData.townState.unlockedTownItems).toEqual(['tree'])
    expect(youngerData.inProgressSession?.currentQuestionIndex).toBe(5)
  })
})

describe('Priority 7 profile and home flows', () => {
  it('プロフィール選択画面から兄弟を切り替える', async () => {
    const repository = new IndexedDbAppRepository(new IDBFactory())
    await repository.saveProfile(profile('older-ui', 'たろう', 3))
    await repository.saveRewardState({ points: 60, level: 2, unlockedItems: [] })
    await repository.saveProfile(profile('younger-ui', 'はな', 1))
    await repository.saveRewardState({ points: 12, level: 1, unlockedItems: [] })

    render(<App repository={repository} />)
    expect(await screen.findByRole('heading', { name: 'だれが勉強する？' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: /たろう.*小学3年生/ }))
    expect(
      await screen.findByText(/60/, { selector: '.home-profile-summary strong' }),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'プロフィール切替' }))
    await userEvent.click(screen.getByRole('button', { name: /はな.*小学1年生/ }))
    expect(
      await screen.findByText(/12/, { selector: '.home-profile-summary strong' }),
    ).toBeVisible()
  })

  it('問題中のホーム復帰で途中結果だけを保存し、完了処理を呼ばない', async () => {
    const onProgress = vi.fn().mockResolvedValue(undefined)
    const onComplete = vi.fn()
    const onHome = vi.fn()
    render(
      <QuestionPage
        questions={[storedQuestion('q-0', 1), storedQuestion('q-1', 1)]}
        onProgress={onProgress}
        onComplete={onComplete}
        onHome={onHome}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '2' }))
    await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
    await userEvent.click(screen.getByRole('button', { name: 'ホーム' }))

    expect(onProgress).toHaveBeenLastCalledWith(1, [
      expect.objectContaining({ questionId: 'q-0', firstAttemptCorrect: true }),
    ])
    expect(onHome).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })
})

describe('Priority 7 lightweight space motion', () => {
  it('CSSアニメーションをtransform/opacity中心にし、reduced-motionで停止する', () => {
    expect(spaceCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(spaceCss).toMatch(/animation:\s*none\s*!important/)
    expect(spaceCss).toContain('@keyframes space-stars-twinkle')
    expect(spaceCss).toContain('@keyframes space-float')
    expect(spaceCss).not.toContain('requestAnimationFrame')
    expect(spaceCss).not.toContain('canvas')
  })
})
