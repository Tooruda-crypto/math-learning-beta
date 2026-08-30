import { useState, type FormEvent } from 'react'
import { AppLogo } from '../components/AppLogo'
import { PrimaryButton } from '../components/PrimaryButton'
import { createProfile } from '../services/profileService'
import type { AppRepository } from '../repositories/AppRepository'
import type { Grade, Profile } from '../types/app'

interface SetupPageProps {
  repository: AppRepository
  onComplete: (profile: Profile) => void
  onCancel?: () => void
}

export function SetupPage({ repository, onComplete, onCancel }: SetupPageProps) {
  const [grade, setGrade] = useState<Grade | null>(null)
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!grade || !nickname.trim()) {
      setError('学年とニックネームを入力してください。')
      return
    }
    setIsSaving(true)
    try {
      onComplete(await createProfile(repository, nickname, grade))
    } catch {
      setError('保存できませんでした。もう一度ためしてください。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="setup-shell">
      <div className="setup-topbar">
        <AppLogo />
        {onCancel && <button className="quiet-button" type="button" onClick={onCancel}>もどる</button>}
      </div>
      <section className="setup-card" aria-labelledby="setup-title">
        <div className="eyebrow">はじめの設定</div>
        <h1 id="setup-title">きみのことを教えてね</h1>
        <p className="lead">ぴったりの算数を用意するための、かんたんな設定です。</p>
        <form onSubmit={handleSubmit} noValidate>
          <fieldset className="form-group">
            <legend>学年</legend>
            <div className="grade-options">
              {([1, 2, 3] as Grade[]).map((value) => (
                <label key={value} className={grade === value ? 'grade-option is-selected' : 'grade-option'}>
                  <input type="radio" name="grade" value={value} checked={grade === value} onChange={() => setGrade(value)} />
                  <span>{value}年生</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-group">
            <label htmlFor="nickname">ニックネーム</label>
            <input
              id="nickname"
              className="text-input"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={12}
              autoComplete="off"
              placeholder="例：はる"
            />
            <p className="field-note">12文字まで入力できます。</p>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <PrimaryButton type="submit" fullWidth disabled={isSaving}>
            {isSaving ? '保存しています…' : 'はじめる'}
          </PrimaryButton>
        </form>
      </section>
    </main>
  )
}
