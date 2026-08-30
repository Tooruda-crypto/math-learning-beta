import { AppRepositoryError, type AppRepository } from '../repositories/AppRepository'
import type {
  AppData,
  AppSettings,
  DailySession,
  InProgressSession,
  Profile,
  ProfileLearningData,
  RewardState,
  SkillProgress,
  TownState,
} from '../types/app'
import {
  createDefaultAppData,
  createDefaultProfileLearningData,
  migrateAppData,
} from './defaultAppData'

const DATABASE_NAME = 'sansu-learning-app'
const DATABASE_VERSION = 1
const STORE_NAME = 'app-data'
const APP_DATA_KEY = 'current'

type DataUpdater = (data: AppData) => AppData

export class IndexedDbAppRepository implements AppRepository {
  private readonly indexedDb: IDBFactory

  constructor(indexedDb: IDBFactory = window.indexedDB) {
    this.indexedDb = indexedDb
  }

  async getAppData(): Promise<AppData> {
    return this.withErrorHandling('getAppData', async () => {
      const database = await this.openDatabase()
      try {
        const transaction = database.transaction(STORE_NAME, 'readonly')
        const result = await this.request<AppData | undefined>(transaction.objectStore(STORE_NAME).get(APP_DATA_KEY))
        await this.transactionComplete(transaction)
        return migrateAppData(result)
      } finally {
        database.close()
      }
    })
  }

  async saveCompletedSession(
    session: DailySession,
    progress: SkillProgress[],
    rewardState?: RewardState,
    townState?: TownState,
  ): Promise<void> {
    await this.update('saveCompletedSession', (data) => {
      return this.updateActiveProfileData(data, (current) => {
        if (current.sessions.some((item) => item.id === session.id)) {
          return current.inProgressSession
            ? { ...current, inProgressSession: null }
            : current
        }
        const skillProgress = { ...current.skillProgress }
        for (const item of progress) skillProgress[item.skillId] = item
        return {
          ...current,
          sessions: [...current.sessions, session],
          inProgressSession: null,
          skillProgress,
          rewardState: rewardState ?? current.rewardState,
          townState: townState ?? current.townState,
        }
      })
    })
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.update('saveProfile', (data) => {
      const profiles = [
        ...data.profiles.filter((item) => item.id !== profile.id),
        profile,
      ]
      const learningData = data.profileData[profile.id] ?? createDefaultProfileLearningData()
      return {
        ...data,
        profiles,
        activeProfileId: profile.id,
        profileData: { ...data.profileData, [profile.id]: learningData },
        profile,
        ...learningData,
      }
    })
  }

  async setActiveProfile(profileId: string): Promise<void> {
    await this.update('setActiveProfile', (data) => {
      const profile = data.profiles.find((item) => item.id === profileId)
      if (!profile) throw new Error('Profile not found')
      const learningData = data.profileData[profileId] ?? createDefaultProfileLearningData()
      return {
        ...data,
        activeProfileId: profileId,
        profile,
        ...learningData,
      }
    })
  }

  async saveInProgressSession(session: InProgressSession | null): Promise<void> {
    await this.update('saveInProgressSession', (data) =>
      this.updateActiveProfileData(data, (current) => ({
        ...current,
        inProgressSession: session,
      })))
  }

  async saveSkillProgress(progress: SkillProgress): Promise<void> {
    await this.update('saveSkillProgress', (data) =>
      this.updateActiveProfileData(data, (current) => ({
        ...current,
        skillProgress: { ...current.skillProgress, [progress.skillId]: progress },
      })))
  }

  async saveSession(session: DailySession): Promise<void> {
    await this.update('saveSession', (data) =>
      this.updateActiveProfileData(data, (current) => ({
        ...current,
        sessions: [...current.sessions.filter((item) => item.id !== session.id), session],
      })))
  }

  async saveRewardState(rewardState: RewardState): Promise<void> {
    await this.update('saveRewardState', (data) =>
      this.updateActiveProfileData(data, (current) => ({ ...current, rewardState })))
  }

  async saveTownState(townState: TownState): Promise<void> {
    await this.update('saveTownState', (data) =>
      this.updateActiveProfileData(data, (current) => ({ ...current, townState })))
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.update('saveSettings', (data) => ({ ...data, settings }))
  }

  private updateActiveProfileData(
    data: AppData,
    updater: (current: ProfileLearningData) => ProfileLearningData,
  ): AppData {
    const profileId = data.activeProfileId
    if (!profileId || !data.profile) throw new Error('Active profile is required')
    const current = data.profileData[profileId] ?? createDefaultProfileLearningData()
    const next = updater(current)
    return {
      ...data,
      profileData: { ...data.profileData, [profileId]: next },
      ...next,
    }
  }

  private async update(operation: string, updater: DataUpdater): Promise<void> {
    await this.withErrorHandling(operation, async () => {
      const database = await this.openDatabase()
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const stored = await this.request<AppData | undefined>(store.get(APP_DATA_KEY))
        const current = stored ? migrateAppData(stored) : createDefaultAppData()
        await this.request(store.put(updater(current), APP_DATA_KEY))
        await this.transactionComplete(transaction)
      } finally {
        database.close()
      }
    })
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let openRequest: IDBOpenDBRequest
      try {
        openRequest = this.indexedDb.open(DATABASE_NAME, DATABASE_VERSION)
      } catch (error) {
        reject(error)
        return
      }
      openRequest.onupgradeneeded = () => {
        const database = openRequest.result
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME)
      }
      openRequest.onsuccess = () => resolve(openRequest.result)
      openRequest.onerror = () => reject(openRequest.error)
      openRequest.onblocked = () => reject(new Error('IndexedDB is blocked'))
    })
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private transactionComplete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    })
  }

  private async withErrorHandling<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action()
    } catch (error) {
      throw new AppRepositoryError('端末への保存または読み込みに失敗しました。', operation, { cause: error })
    }
  }
}
