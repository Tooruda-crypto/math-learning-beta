import { describe, expect, it } from 'vitest'
import {
  addSessionReward,
  calculateEarnedPoints,
  calculateRewardLevel,
  getRewardLevelProgress,
} from './reward'

describe('reward', () => {
  it('完了報酬10と初回正解1問につき1ポイントを計算する', () => {
    expect(calculateEarnedPoints(0)).toBe(10)
    expect(calculateEarnedPoints(7)).toBe(17)
    expect(calculateEarnedPoints(10)).toBe(20)
  })

  it.each([
    [0, 1], [49, 1], [50, 2], [99, 2], [100, 3], [199, 3],
    [200, 4], [349, 4], [350, 5], [549, 5], [550, 6], [800, 7],
  ])('%iポイントをLevel %iにする', (points, level) => {
    expect(calculateRewardLevel(points)).toBe(level)
  })

  it('既存ポイントと解放状態を失わずにセッション報酬を加える', () => {
    const updated = addSessionReward(
      { points: 45, level: 1, unlockedItems: ['starter'] },
      17,
    )
    expect(updated).toEqual({
      points: 62,
      level: 2,
      unlockedItems: ['starter'],
    })
    expect(getRewardLevelProgress(62)).toMatchObject({
      level: 2,
      remainingPoints: 38,
    })
  })
})
