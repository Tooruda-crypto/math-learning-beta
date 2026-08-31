export type Grade = 1 | 2 | 3

export interface Profile {
  id: string
  nickname: string
  grade: Grade
  createdAt: string
  updatedAt: string
}

export interface SkillProgress {
  skillId: string
  attempts: number
  correctCount: number
  recentResults: boolean[]
  recentAccuracy: number
  level: number
  lastStudiedAt: string | null
}

export interface QuestionResult {
  questionId: string
  skillId: string
  question: string
  correctAnswer: string
  selectedAnswer: string
  firstAttemptCorrect: boolean
  retryCorrect: boolean | null
  responseTimeMs: number
  answeredAt: string
}

export type StoredQuestionAnswer = number | string
export type StoredQuestionPresentationType =
  | 'calculation'
  | 'fill-blank'
  | 'comparison'
  | 'word-problem'
  | 'quotient'
  | 'remainder'
  | 'fraction'
  | 'clock'
  | 'measurement'
  | 'money'
  | 'number-concept'

export interface StoredQuestionVisual {
  type: 'analog-clock'
  hour: number
  minute: number
}

export interface StoredQuestionChoice {
  id: string
  label: string
  value: StoredQuestionAnswer
}

export interface StoredLearningQuestion {
  id: string
  grade: Grade
  skillId: string
  prompt: string
  correctAnswer: StoredQuestionAnswer
  choices: StoredQuestionChoice[]
  hint: string
  difficulty: 1 | 2 | 3
  /** Priority 8以降。旧途中データでは未定義。 */
  presentationType?: StoredQuestionPresentationType
  /** Priority 9以降。旧途中データでは未定義。 */
  visual?: StoredQuestionVisual
}

export interface InProgressSession {
  sessionId: string
  startedAt: string
  grade: Grade
  questions: StoredLearningQuestion[]
  currentQuestionIndex: number
  results: QuestionResult[]
}

export interface DailySession {
  id: string
  date: string
  startedAt: string
  completedAt: string
  grade: Grade
  questions: QuestionResult[]
  completed: boolean
  score: number
  /** 完了報酬10 + 初回正解数。Priority 2以前の履歴では0の場合がある。 */
  earnedPoints: number
}

export interface RewardState {
  points: number
  level: number
  unlockedItems: string[]
}

export interface TownState {
  unlockedTownItems: string[]
}

export interface AppSettings {
  dailyQuestionCount: number
  hintsEnabled: boolean
}

export interface ProfileLearningData {
  skillProgress: Record<string, SkillProgress>
  sessions: DailySession[]
  inProgressSession: InProgressSession | null
  rewardState: RewardState
  townState: TownState
}

export interface AppData {
  schemaVersion: number
  /** Profile.idをprofileIdとして使用する。 */
  profiles: Profile[]
  activeProfileId: string | null
  profileData: Record<string, ProfileLearningData>
  /** 以下は選択中プロフィールの投影。既存Domain/Service互換のため保持する。 */
  profile: Profile | null
  skillProgress: Record<string, SkillProgress>
  sessions: DailySession[]
  inProgressSession: InProgressSession | null
  rewardState: RewardState
  townState: TownState
  settings: AppSettings
}
