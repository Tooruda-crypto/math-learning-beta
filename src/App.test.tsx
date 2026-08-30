import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { AppRepository } from './repositories/AppRepository'
import { createDefaultAppData } from './storage/defaultAppData'
import { IndexedDbAppRepository } from './storage/IndexedDbAppRepository'
import type { InProgressSession, QuestionResult } from './types/app'

function appDataForProfile(profile: NonNullable<ReturnType<typeof createDefaultAppData>['profile']>) {
  const defaults = createDefaultAppData()
  const learningData = {
    skillProgress: defaults.skillProgress,
    sessions: defaults.sessions,
    inProgressSession: defaults.inProgressSession,
    rewardState: defaults.rewardState,
    townState: defaults.townState,
  }
  return {
    ...defaults,
    profiles: [profile],
    activeProfileId: profile.id,
    profileData: { [profile.id]: learningData },
    profile,
  }
}

describe('App session persistence flow', () => {
  it('開始ボタンを連打しても途中セッションを二重生成しない', async () => {
    let resolveSave!: () => void
    const pendingSave = new Promise<void>((resolve) => { resolveSave = resolve })
    const appData = appDataForProfile({
        id: 'profile-1', nickname: 'はる', grade: 1 as const,
        createdAt: '2026-08-29T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z',
    })
    const saveInProgressSession = vi.fn().mockReturnValue(pendingSave)
    const repository: AppRepository = {
      getAppData: vi.fn().mockResolvedValue(appData),
      saveCompletedSession: vi.fn(), saveProfile: vi.fn(), setActiveProfile: vi.fn(),
      saveInProgressSession, saveSkillProgress: vi.fn(), saveSession: vi.fn(),
      saveRewardState: vi.fn(), saveTownState: vi.fn(), saveSettings: vi.fn(),
    }
    render(<App repository={repository} />)

    await userEvent.click(await screen.findByRole('button', { name: /はる.*小学1年生/ }))
    const button = await screen.findByRole('button', { name: '今日の算数をはじめる' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(saveInProgressSession).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: '準備しています…' })).toBeDisabled()
    resolveSave()
    expect(await screen.findByLabelText('10もん中1もん目')).toBeVisible()
  })

  it('保存失敗時は結果画面に進まず、再試行成功後だけ完了表示する', async () => {
    const appData = appDataForProfile({
        id: 'profile-1', nickname: 'はる', grade: 2 as const,
        createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
    })
    const saveCompletedSession = vi.fn()
      .mockRejectedValueOnce(new Error('save failed'))
      .mockResolvedValue(undefined)
    const saveInProgressSession = vi.fn()
    const repository: AppRepository = {
      getAppData: vi.fn().mockResolvedValue(appData),
      saveCompletedSession,
      saveProfile: vi.fn(), setActiveProfile: vi.fn(), saveInProgressSession, saveSkillProgress: vi.fn(), saveSession: vi.fn(),
      saveRewardState: vi.fn(), saveTownState: vi.fn(), saveSettings: vi.fn(),
    }
    render(<App repository={repository} />)

    await userEvent.click(await screen.findByRole('button', { name: /はる.*小学2年生/ }))
    await userEvent.click(await screen.findByRole('button', { name: '今日の算数をはじめる' }))
    for (let index = 0; index < 10; index += 1) {
      const latestSession = saveInProgressSession.mock.calls.at(-1)?.[0] as InProgressSession
      const answer = latestSession.questions[index].correctAnswer
      await userEvent.click(screen.getByRole('button', { name: String(answer) }))
      await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
      await userEvent.click(screen.getByRole('button', {
        name: index === 9 ? 'けっかをみる' : 'つぎのもんだい',
      }))
    }

    expect(await screen.findByRole('heading', { name: '学習結果を保存できませんでした' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '今日もできた！' })).not.toBeInTheDocument()
    expect(saveCompletedSession).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'もう一度保存する' }))
    expect(await screen.findByRole('heading', { name: '今日もできた！' })).toBeVisible()
    expect(screen.getByText('今日の学習を保存しました')).toBeVisible()
    expect(saveCompletedSession).toHaveBeenCalledTimes(2)
    expect(saveCompletedSession.mock.calls[1][0]).toMatchObject({
      completed: true, score: 10, earnedPoints: 20,
    })
    expect(saveCompletedSession.mock.calls[1][0].questions).toHaveLength(10)
    expect(saveCompletedSession.mock.calls[1][1].length).toBeGreaterThan(1)
    expect(saveCompletedSession.mock.calls[1][2]).toMatchObject({
      points: 20, level: 1,
    })
  })

  it('再読込後に途中の問題番号と確定回答から再開し、完了時だけ報酬へ反映する', async () => {
    const indexedDb = new IDBFactory()
    const seedRepository = new IndexedDbAppRepository(indexedDb)
    await seedRepository.saveProfile({
      id: 'profile-resume',
      nickname: 'そら',
      grade: 1,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    })
    const storedQuestions = Array.from({ length: 10 }, (_, index) => ({
      id: `resume-q-${index}`,
      grade: 1 as const,
      skillId: 'g1-add-within-10',
      prompt: '1 + 1 = ?',
      correctAnswer: 2,
      choices: [1, 2, 3, 4].map((value) => ({
        id: String(value), label: String(value), value,
      })),
      hint: '1から1こ先を数えてみよう。',
      difficulty: 1 as const,
    }))
    const storedResults = Array.from({ length: 3 }, (_, index): QuestionResult => ({
      questionId: `resume-q-${index}`,
      skillId: 'g1-add-within-10',
      question: '1 + 1 = ?',
      correctAnswer: '2',
      selectedAnswer: '2',
      firstAttemptCorrect: true,
      retryCorrect: null,
      responseTimeMs: 100,
      answeredAt: '2026-08-28T00:01:00.000Z',
    }))
    const inProgress: InProgressSession = {
      sessionId: 'resume-session',
      startedAt: '2026-08-28T00:00:00.000Z',
      grade: 1,
      questions: storedQuestions,
      currentQuestionIndex: 3,
      results: storedResults,
    }
    await seedRepository.saveInProgressSession(inProgress)

    const repository = new IndexedDbAppRepository(indexedDb)
    render(<App repository={repository} />)

    await userEvent.click(await screen.findByRole('button', { name: /そら.*小学1年生/ }))
    expect(await screen.findByText('3 / 10')).toBeVisible()
    expect((await repository.getAppData()).rewardState.points).toBe(0)
    await userEvent.click(screen.getByRole('button', { name: 'つづきから' }))
    expect(screen.getByText('4', { selector: '.learning-count strong' })).toBeVisible()

    for (let index = 3; index < 10; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: '2' }))
      await userEvent.click(screen.getByRole('button', { name: '答えを決める' }))
      expect(await screen.findByText('せいかい！')).toBeVisible()
      await userEvent.click(screen.getByRole('button', {
        name: index === 9 ? 'けっかをみる' : 'つぎのもんだい',
      }))
    }

    expect(await screen.findByRole('heading', { name: '今日もできた！' })).toBeVisible()
    const reloaded = await new IndexedDbAppRepository(indexedDb).getAppData()
    expect(reloaded.inProgressSession).toBeNull()
    expect(reloaded.sessions).toHaveLength(1)
    expect(reloaded.sessions[0].questions).toHaveLength(10)
    expect(reloaded.skillProgress['g1-add-within-10'].attempts).toBe(10)
    expect(reloaded.rewardState.points).toBe(20)
  })
})
