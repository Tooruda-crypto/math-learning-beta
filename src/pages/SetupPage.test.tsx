import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AppRepository } from '../repositories/AppRepository'
import { SetupPage } from './SetupPage'

function createRepository(saveProfile = vi.fn().mockResolvedValue(undefined)): AppRepository {
  return {
    getAppData: vi.fn(), saveCompletedSession: vi.fn(), saveProfile, setActiveProfile: vi.fn(), saveInProgressSession: vi.fn(), saveSkillProgress: vi.fn(), saveSession: vi.fn(),
    saveRewardState: vi.fn(), saveTownState: vi.fn(), saveSettings: vi.fn(),
  }
}

describe('SetupPage', () => {
  it('必須項目が空のとき保存しない', async () => {
    const repository = createRepository()
    render(<SetupPage repository={repository} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'はじめる' }))
    expect(repository.saveProfile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('学年とニックネーム')
  })

  it('保存成功後だけ完了を通知する', async () => {
    const onComplete = vi.fn()
    const repository = createRepository()
    render(<SetupPage repository={repository} onComplete={onComplete} />)
    await userEvent.click(screen.getByText('2年生'))
    await userEvent.type(screen.getByLabelText('ニックネーム'), ' はる ')
    await userEvent.click(screen.getByRole('button', { name: 'はじめる' }))
    expect(repository.saveProfile).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'はる', grade: 2 }))
  })

  it('保存失敗を成功扱いにしない', async () => {
    const onComplete = vi.fn()
    const repository = createRepository(vi.fn().mockRejectedValue(new Error('failed')))
    render(<SetupPage repository={repository} onComplete={onComplete} />)
    await userEvent.click(screen.getByText('1年生'))
    await userEvent.type(screen.getByLabelText('ニックネーム'), 'そら')
    await userEvent.click(screen.getByRole('button', { name: 'はじめる' }))
    expect(onComplete).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('保存できませんでした')
  })
})
