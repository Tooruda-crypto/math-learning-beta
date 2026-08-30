import { describe, expect, it } from 'vitest'
import { getNextTownUnlock, updateTownState } from './town'

describe('town', () => {
  it.each([
    [1, ['tree']],
    [3, ['tree', 'flowers', 'bench']],
    [7, ['tree', 'flowers', 'bench', 'small-house', 'shop']],
    [30, ['tree', 'flowers', 'bench', 'small-house', 'shop', 'park', 'streetlight', 'big-tree', 'second-house']],
  ])('%i学習日で条件までの街アイテムを解放する', (days, expected) => {
    expect(updateTownState({ unlockedTownItems: [] }, days).townState.unlockedTownItems).toEqual(expected)
  })

  it('既存アイテムを重複追加せず、新規解放だけを通知する', () => {
    const result = updateTownState(
      { unlockedTownItems: ['tree', 'flowers', 'custom-item'] },
      3,
    )
    expect(result.townState.unlockedTownItems).toEqual([
      'tree', 'flowers', 'custom-item', 'bench',
    ])
    expect(result.newlyUnlockedItemIds).toEqual(['bench'])
  })

  it('次の解放までの日数を返す', () => {
    expect(getNextTownUnlock(3)).toMatchObject({
      remainingDays: 2,
      item: { id: 'small-house', name: '小さな家' },
    })
    expect(getNextTownUnlock(30)).toBeNull()
  })
})
