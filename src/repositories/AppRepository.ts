import type {
  AppData,
  AppSettings,
  DailySession,
  InProgressSession,
  Profile,
  RewardState,
  SkillProgress,
  TownState,
} from '../types/app'

export interface AppRepository {
  getAppData(): Promise<AppData>
  saveCompletedSession(
    session: DailySession,
    progress: SkillProgress[],
    rewardState?: RewardState,
    townState?: TownState,
  ): Promise<void>
  saveProfile(profile: Profile): Promise<void>
  setActiveProfile(profileId: string): Promise<void>
  saveInProgressSession(session: InProgressSession | null): Promise<void>
  saveSkillProgress(progress: SkillProgress): Promise<void>
  saveSession(session: DailySession): Promise<void>
  saveRewardState(state: RewardState): Promise<void>
  saveTownState(state: TownState): Promise<void>
  saveSettings(settings: AppSettings): Promise<void>
}

export class AppRepositoryError extends Error {
  readonly operation: string

  constructor(
    message: string,
    operation: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AppRepositoryError'
    this.operation = operation
  }
}
