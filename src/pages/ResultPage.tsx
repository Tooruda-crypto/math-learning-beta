import { getTownItem } from '../domain/town/town'
import type { TownItemId } from '../domain/town/town'
import type { QuestionResult } from '../types/app'
import { RocketIcon, TownItemIcon } from '../components/SpaceIcon'

interface ResultPageProps {
  results: QuestionResult[]
  earnedPoints: number
  newlyUnlockedTownItemIds: TownItemId[]
  onTown: () => void
  onFinish: () => void
}

export function ResultPage({
  results,
  earnedPoints,
  newlyUnlockedTownItemIds,
  onTown,
  onFinish,
}: ResultPageProps) {
  const firstAttemptCorrect = results.filter((result) => result.firstAttemptCorrect).length
  const newlyUnlockedItems = newlyUnlockedTownItemIds
    .map(getTownItem)
    .filter((item) => Boolean(item))

  return (
    <main className="result-shell">
      <section className="result-card" aria-labelledby="result-title">
        <span className="result-star result-star--one" aria-hidden="true">✦</span>
        <span className="result-star result-star--two" aria-hidden="true">✧</span>
        <span className="result-star result-star--three" aria-hidden="true">✦</span>
        <RocketIcon className="result-rocket" />
        <div className="result-check" aria-hidden="true">★</div>
        <p className="result-kicker">きょうの算数コース</p>
        <h1 id="result-title">今日もできた！</h1>
        <p className="save-success">今日の学習を保存しました</p>
        <div className="result-summary">
          <div><strong>{results.length}</strong><span>もん完了</span></div>
          <div><strong>{firstAttemptCorrect}</strong><span>はじめに正解</span></div>
          <div className="result-points"><strong>+{earnedPoints}</strong><span>ポイント</span></div>
        </div>
        {newlyUnlockedItems.length > 0 && (
          <p className="town-unlock-message">
            <TownItemIcon itemId={newlyUnlockedItems[0]!.id} />
            <span>宇宙の町に<br />新しい施設が増えたよ</span>
          </p>
        )}
        <div className="result-actions">
          <button className="button button--secondary" type="button" onClick={onTown}>宇宙の町をみる</button>
          <button className="button button--primary" type="button" onClick={onFinish}>ホームにもどる</button>
        </div>
      </section>
    </main>
  )
}
