import { calculateStudyStats } from '../domain/progress/studyHistory'
import { SKILL_NAMES, SKILL_SEQUENCE_BY_GRADE } from '../domain/skills/learningPath'
import { assessSkillProgress, type SkillState } from '../domain/skills/proficiency'
import type { AppData } from '../types/app'

interface ParentProgressPageProps {
  appData: AppData
  onBack: () => void
}

const PROFICIENCY_LABELS: Record<SkillState, string> = {
  UNSEEN: 'これから学習します',
  LEARNING: '練習中です',
  FOCUS: 'もう少し練習すると安心です',
  REVIEW: '復習おすすめ',
  STABLE: '安定してきています',
  MASTERED: 'よく身についています',
}

export function ParentProgressPage({ appData, onBack }: ParentProgressPageProps) {
  const stats = calculateStudyStats(appData.sessions)
  const completedSessions = appData.sessions.filter(
    (session) => session.completed && session.questions.length === 10,
  )
  const totalQuestions = completedSessions.reduce(
    (total, session) => total + session.questions.length,
    0,
  )
  const weeklyStudyCount = stats.weeklyStudyDays.filter(
    (day) => day.studied,
  ).length
  const grade = appData.profile?.grade ?? 1

  return (
    <main className="parent-shell">
      <header className="parent-header">
        <div>
          <span className="section-kicker">学習の記録</span>
          <h1>保護者の方へ</h1>
          <p><strong>{appData.profile?.nickname}</strong> ・ 小学{grade}年生</p>
          <p>日々の取り組みと、単元ごとの様子を確認できます。</p>
        </div>
        <button className="parent-back" type="button" onClick={onBack}>
          ホームへ戻る
        </button>
      </header>

      <section className="parent-summary" aria-label="学習の概要">
        <div><span>今週の学習日数</span><strong>{weeklyStudyCount}日</strong></div>
        <div><span>これまでの学習日数</span><strong>{stats.totalStudyDays}日</strong></div>
        <div><span>完了セッション</span><strong>{completedSessions.length}回</strong></div>
        <div><span>解いた問題</span><strong>{totalQuestions}問</strong></div>
        <div><span>全体レベル</span><strong>Level {appData.rewardState.level}</strong></div>
        <div><span>ポイント</span><strong>{appData.rewardState.points} pt</strong></div>
        <div><span>現在の連続日数</span><strong>{stats.currentStreak}日</strong></div>
        <div><span>最長の連続日数</span><strong>{stats.bestStreak}日</strong></div>
      </section>

      <section className="parent-skills" aria-labelledby="skill-progress-title">
        <div className="parent-section-heading">
          <span className="section-kicker">単元別</span>
          <h2 id="skill-progress-title">学習の様子</h2>
        </div>
        <div className="skill-progress-list">
          {SKILL_SEQUENCE_BY_GRADE[grade].map((skillId) => {
            const progress = appData.skillProgress[skillId]
            const assessment = assessSkillProgress(progress)
            return (
              <article className="skill-progress-card" key={skillId}>
                <div>
                  <h3>{SKILL_NAMES[skillId]}</h3>
                  <p>{PROFICIENCY_LABELS[assessment.state]}</p>
                </div>
                <dl>
                  <div><dt>取り組んだ問題</dt><dd>{progress?.attempts ?? 0}問</dd></div>
                  <div>
                    <dt>最近の正答率</dt>
                    <dd>{progress ? `${Math.round(progress.recentAccuracy * 100)}%` : '—'}</dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
