import type { AppRepository } from '../repositories/AppRepository'
import type { Grade, Profile } from '../types/app'

export async function createProfile(repository: AppRepository, nickname: string, grade: Grade): Promise<Profile> {
  const normalizedNickname = nickname.trim()
  if (!normalizedNickname) throw new Error('ニックネームを入力してください。')

  const now = new Date().toISOString()
  const profile: Profile = {
    id: crypto.randomUUID(),
    nickname: normalizedNickname,
    grade,
    createdAt: now,
    updatedAt: now,
  }
  await repository.saveProfile(profile)
  return profile
}
