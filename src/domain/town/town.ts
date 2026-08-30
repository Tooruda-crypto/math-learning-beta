import type { TownState } from '../../types/app'

export type TownItemId =
  | 'tree'
  | 'flowers'
  | 'bench'
  | 'small-house'
  | 'shop'
  | 'park'
  | 'streetlight'
  | 'big-tree'
  | 'second-house'

export interface TownItemDefinition {
  id: TownItemId
  name: string
  icon: string
  requiredStudyDays: number
}

export const TOWN_ITEMS: readonly TownItemDefinition[] = [
  { id: 'tree', name: '木', icon: '🌳', requiredStudyDays: 1 },
  { id: 'flowers', name: '花', icon: '🌼', requiredStudyDays: 2 },
  { id: 'bench', name: 'ベンチ', icon: '🪑', requiredStudyDays: 3 },
  { id: 'small-house', name: '小さな家', icon: '🏠', requiredStudyDays: 5 },
  { id: 'shop', name: 'お店', icon: '🏪', requiredStudyDays: 7 },
  { id: 'park', name: '公園', icon: '🌿', requiredStudyDays: 10 },
  { id: 'streetlight', name: '街灯', icon: '💡', requiredStudyDays: 14 },
  { id: 'big-tree', name: '大きな木', icon: '🌲', requiredStudyDays: 20 },
  { id: 'second-house', name: 'もう1軒の家', icon: '🏡', requiredStudyDays: 30 },
]

export function getTownItem(itemId: string): TownItemDefinition | undefined {
  return TOWN_ITEMS.find((item) => item.id === itemId)
}

export function updateTownState(
  current: TownState,
  totalStudyDays: number,
): { townState: TownState; newlyUnlockedItemIds: TownItemId[] } {
  const existing = new Set(current.unlockedTownItems)
  const eligible = TOWN_ITEMS.filter(
    (item) => item.requiredStudyDays <= totalStudyDays,
  )
  const newlyUnlockedItemIds = eligible
    .filter((item) => !existing.has(item.id))
    .map((item) => item.id)

  return {
    townState: {
      unlockedTownItems: [
        ...new Set([
          ...current.unlockedTownItems,
          ...eligible.map((item) => item.id),
        ]),
      ],
    },
    newlyUnlockedItemIds,
  }
}

export function getNextTownUnlock(totalStudyDays: number) {
  const item = TOWN_ITEMS.find(
    (candidate) => candidate.requiredStudyDays > totalStudyDays,
  )
  if (!item) return null
  return {
    item,
    remainingDays: item.requiredStudyDays - totalStudyDays,
  }
}
