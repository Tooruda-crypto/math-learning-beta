import { AppLogo } from '../components/AppLogo'
import { PrimaryButton } from '../components/PrimaryButton'
import { RocketIcon, SpaceIcon, TownItemIcon } from '../components/SpaceIcon'
import { calculateStudyStats } from '../domain/progress/studyHistory'
import { createDailyQuestionPlan } from '../domain/questions/dailyQuestionPlan'
import { SKILL_NAMES } from '../domain/skills/learningPath'
import { getNextTownUnlock, TOWN_ITEMS } from '../domain/town/town'
import type {
  DailySession,
  InProgressSession,
  Profile,
  RewardState,
  SkillProgress,
  TownState,
} from '../types/app'

interface HomePageProps {
  profile: Profile
  rewardState: RewardState
  townState: TownState
  sessions: DailySession[]
  skillProgress: Record<string, SkillProgress>
  inProgressSession: InProgressSession | null
  startError: boolean
  isStarting: boolean
  onStart: () => void
  onResume: () => void
  onParent: () => void
  onSwitchProfile: () => void
}

const SPACE_TOWN_NAMES: Record<string, string> = {
  tree: '宇宙植物',
  flowers: '光る花',
  bench: '月面ベンチ',
  'small-house': 'ドームハウス',
  shop: '宇宙ショップ',
  park: 'コロニーパーク',
  streetlight: '光るビーコン',
  'big-tree': '星の大樹',
  'second-house': '第2ドーム',
}

export function HomePage({
  profile,
  rewardState,
  townState,
  sessions,
  skillProgress,
  inProgressSession,
  startError,
  isStarting,
  onStart,
  onResume,
  onParent,
  onSwitchProfile,
}: HomePageProps) {
  const studyStats = calculateStudyStats(sessions)
  const unlockedItemIds = new Set(townState.unlockedTownItems)
  const nextUnlock = getNextTownUnlock(studyStats.totalStudyDays)
  const questionPlan = createDailyQuestionPlan(profile.grade, skillProgress)
  const currentSkillName = SKILL_NAMES[questionPlan.currentSkillId]

  return (
    <main className="app-shell">
      <header className="home-header">
        <AppLogo />
        <div className="home-profile-summary">
          <span>小学{profile.grade}年生</span>
          <strong>{rewardState.points}<small> pt</small></strong>
          <strong>Level {rewardState.level}</strong>
          <button type="button" onClick={onSwitchProfile}>プロフィール切替</button>
        </div>
      </header>
      <div className="home-grid">
        <section className="today-card" aria-labelledby="today-title">
          <span className="today-star today-star--one" aria-hidden="true">✦</span>
          <span className="today-star today-star--two" aria-hidden="true">✧</span>
          <span className="today-star today-star--three" aria-hidden="true">✦</span>
          <RocketIcon className="home-rocket" />
          <SpaceIcon className="home-planet" variant={0} />
          <div className="today-card__copy">
            <span className="status-chip">{profile.nickname}さんのコース</span>
            <h1 id="today-title">きょうの <span>さんすう</span></h1>
            <div className="session-meta" aria-label="10もん、約5分">
              <span><strong>10</strong> もん</span><span className="meta-divider" aria-hidden="true" /><span>約 <strong>5</strong> 分</span>
            </div>
            {inProgressSession ? (
              <p className="resume-note">
                <strong>{inProgressSession.currentQuestionIndex} / {inProgressSession.questions.length}</strong>
                までできています
              </p>
            ) : (
              <p>きょうは「{currentSkillName}」を中心に学びます。</p>
            )}
          </div>
          <PrimaryButton
            onClick={inProgressSession ? onResume : onStart}
            fullWidth
            disabled={isStarting}
          >
            {inProgressSession
              ? 'つづきから'
              : isStarting
                ? '準備しています…'
                : '今日の算数をはじめる'}
          </PrimaryButton>
          {startError && (
            <p className="home-start-error" role="alert">
              学習の準備を保存できませんでした。もう一度お試しください。
            </p>
          )}
        </section>
        <section className="week-card" aria-labelledby="week-title">
          <div className="week-card__heading">
            <span className="section-kicker">つづけた記録</span>
            <h2 id="week-title">今週の学習</h2>
            <p>
              これまで <strong>{studyStats.totalStudyDays}日</strong>
              {studyStats.currentStreak > 0 && (
                <> ・いま <strong>{studyStats.currentStreak}日</strong>つづいているよ</>
              )}
              {studyStats.bestStreak > 0 && (
                <> ・いちばん <strong>{studyStats.bestStreak}日</strong></>
              )}
            </p>
          </div>
          <div className="week-days">
            {studyStats.weeklyStudyDays.map((day) => (
              <div className="week-day" key={day.date}>
                <span>{day.label}</span>
                <i
                  className={day.studied ? 'is-done' : day.isToday ? 'is-today' : ''}
                  aria-label={day.studied ? '学習した日' : day.isToday ? '今日' : 'まだ学習していない日'}
                >
                  {day.studied ? '✓' : ''}
                </i>
              </div>
            ))}
          </div>
        </section>
        <section className="town-card space-colony" aria-labelledby="town-title">
          <div className="town-card__heading">
            <div><span className="section-kicker">まなびのコロニー</span><h2 id="town-title">宇宙の町</h2></div>
            <span className="coming-soon">
              {nextUnlock
                ? `あと${nextUnlock.remainingDays}日で新しい施設`
                : '町がにぎやかになったね'}
            </span>
          </div>
          <div className="town-scene" aria-label="学習で育った小さな町">
            <div className="town-sun" />
            <div className="town-orbit" />
            <div className="town-distant town-distant--one" />
            <div className="town-distant town-distant--two" />
            <div className="town-ground" />
            <div className="town-items">
              {TOWN_ITEMS.map((item) => {
                const isUnlocked = unlockedItemIds.has(item.id)
                const isNext = nextUnlock?.item.id === item.id
                return (
                <div
                  className={`town-item ${isUnlocked ? 'is-unlocked' : 'is-locked'} ${isNext ? 'is-next' : ''}`}
                  key={item.id}
                  aria-label={`${SPACE_TOWN_NAMES[item.id] ?? item.name}${isUnlocked ? ' 解放済み' : ` ${item.requiredStudyDays}日で解放`}`}
                >
                  <TownItemIcon itemId={item.id} />
                  <small>{SPACE_TOWN_NAMES[item.id] ?? item.name}</small>
                </div>
                )
              })}
            </div>
            <div className="town-progress-line" aria-hidden="true">
              <span style={{ width: `${(unlockedItemIds.size / TOWN_ITEMS.length) * 100}%` }} />
            </div>
          </div>
        </section>
        <div className="parent-link-row">
          <button className="parent-link" type="button" onClick={onParent}>
            保護者の方へ
          </button>
        </div>
      </div>
    </main>
  )
}
