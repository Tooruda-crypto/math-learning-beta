import { AppLogo } from '../components/AppLogo'
import { SpaceIcon } from '../components/SpaceIcon'
import type { Profile } from '../types/app'

interface ProfileSelectPageProps {
  profiles: Profile[]
  selectingProfileId: string | null
  error: boolean
  onSelect: (profileId: string) => void
  onAdd: () => void
}

function iconVariant(profile: Profile, index: number): number {
  return [...profile.id].reduce((total, character) => total + character.charCodeAt(0), index)
}

export function ProfileSelectPage({
  profiles,
  selectingProfileId,
  error,
  onSelect,
  onAdd,
}: ProfileSelectPageProps) {
  return (
    <main className="profile-select-shell space-screen">
      <AppLogo />
      <section className="profile-select-card" aria-labelledby="profile-select-title">
        <div className="profile-orbit" aria-hidden="true"><span /></div>
        <p className="space-kicker">きょうのクルー</p>
        <h1 id="profile-select-title">だれが勉強する？</h1>
        <p className="profile-select-lead">自分の星をえらんで、算数をはじめよう。</p>
        <div className="profile-list">
          {profiles.map((profile, index) => (
            <button
              className="profile-choice"
              type="button"
              key={profile.id}
              disabled={selectingProfileId !== null}
              onClick={() => onSelect(profile.id)}
            >
              <span className="profile-choice__icon">
                <SpaceIcon variant={iconVariant(profile, index)} />
              </span>
              <span className="profile-choice__copy">
                <strong>{profile.nickname}</strong>
                <small>小学{profile.grade}年生</small>
              </span>
              <span className="profile-choice__arrow" aria-hidden="true">›</span>
            </button>
          ))}
          <button className="profile-add" type="button" onClick={onAdd} disabled={selectingProfileId !== null}>
            <span aria-hidden="true">＋</span> あたらしく追加
          </button>
        </div>
        {selectingProfileId && <p className="profile-status" role="status">星の記録を読み込んでいます…</p>}
        {error && <p className="profile-error" role="alert">記録を読み込めませんでした。もう一度ためしてください。</p>}
      </section>
    </main>
  )
}
