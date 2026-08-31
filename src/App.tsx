import { useEffect, useMemo, useRef, useState } from 'react'
import { ScreenMessage } from './components/ScreenMessage'
import { createPersonalizedQuestionSession } from './domain/questions/dailyQuestionPlan'
import {
  generateQuestionForProblemType,
  getPriority8ProblemTypes,
  getPriority9ProblemTypes,
} from './domain/questions/generator'
import type { LearningQuestion } from './domain/questions/types'
import { HomePage } from './pages/HomePage'
import { ParentProgressPage } from './pages/ParentProgressPage'
import { ProfileSelectPage } from './pages/ProfileSelectPage'
import { QuestionPage } from './pages/QuestionPage'
import { ResultPage } from './pages/ResultPage'
import { SaveStatusPage } from './pages/SaveStatusPage'
import { SetupPage } from './pages/SetupPage'
import type { AppRepository } from './repositories/AppRepository'
import {
  saveCompletedLearningSession,
  type CompletedLearningSessionResult,
} from './services/learningSessionService'
import { IndexedDbAppRepository } from './storage/IndexedDbAppRepository'
import type {
  AppData,
  InProgressSession,
  Profile,
  QuestionResult,
} from './types/app'

type View = 'profile-select' | 'setup' | 'home' | 'question' | 'saving' | 'save-error' | 'result' | 'parent'

export default function App({ repository: repositoryProp }: { repository?: AppRepository }) {
  const repository = useMemo(() => repositoryProp ?? new IndexedDbAppRepository(), [repositoryProp])
  const [appData, setAppData] = useState<AppData | null>(null)
  const [view, setView] = useState<View>('profile-select')
  const [loadError, setLoadError] = useState(false)
  const [questions, setQuestions] = useState<LearningQuestion[]>([])
  const [sessionResults, setSessionResults] = useState<QuestionResult[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null)
  const [completedSession, setCompletedSession] = useState<CompletedLearningSessionResult | null>(null)
  const [initialQuestionIndex, setInitialQuestionIndex] = useState(0)
  const [startError, setStartError] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const startPending = useRef(false)
  const [selectingProfileId, setSelectingProfileId] = useState<string | null>(null)
  const [profileSelectError, setProfileSelectError] = useState(false)
  const previewQuestion = useMemo(() => {
    if (!import.meta.env.DEV) return null
    const requested = new URLSearchParams(window.location.search).get('previewProblem')
    const problemType = [...getPriority8ProblemTypes(), ...getPriority9ProblemTypes()]
      .find((type) => type === requested)
    return problemType ? generateQuestionForProblemType(problemType) : null
  }, [])

  useEffect(() => {
    let active = true
    repository.getAppData().then((data) => active && setAppData(data)).catch(() => active && setLoadError(true))
    return () => { active = false }
  }, [repository])

  if (loadError) return <ScreenMessage>データを読み込めませんでした。ページを開き直してください。</ScreenMessage>
  if (!appData) return <ScreenMessage>算数の準備をしています…</ScreenMessage>
  if (previewQuestion) {
    return (
      <QuestionPage
        questions={Array.from({ length: 10 }, (_, index) => ({
          ...previewQuestion,
          id: `${previewQuestion.id}-preview-${index}`,
        }))}
        onComplete={() => undefined}
      />
    )
  }

  const handleSetupComplete = async (_profile: Profile) => {
    setAppData(await repository.getAppData())
    setView('home')
  }

  const selectProfile = async (profileId: string) => {
    if (selectingProfileId) return
    setSelectingProfileId(profileId)
    setProfileSelectError(false)
    try {
      await repository.setActiveProfile(profileId)
      setAppData(await repository.getAppData())
      setQuestions([])
      setSessionResults([])
      setSessionId(null)
      setSessionStartedAt(null)
      setCompletedSession(null)
      setView('home')
    } catch {
      setProfileSelectError(true)
    } finally {
      setSelectingProfileId(null)
    }
  }

  const startSession = async () => {
    if (startPending.current) return
    startPending.current = true
    setIsStarting(true)
    const session = createPersonalizedQuestionSession(
      appData.profile!.grade,
      appData.skillProgress,
    )
    const inProgressSession: InProgressSession = {
      sessionId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      grade: appData.profile!.grade,
      questions: session.questions,
      currentQuestionIndex: 0,
      results: [],
    }
    try {
      await repository.saveInProgressSession(inProgressSession)
    } catch {
      setStartError(true)
      startPending.current = false
      setIsStarting(false)
      return
    }
    startPending.current = false
    setIsStarting(false)
    setStartError(false)
    setQuestions(inProgressSession.questions)
    setSessionResults(inProgressSession.results)
    setCompletedSession(null)
    setSessionId(inProgressSession.sessionId)
    setSessionStartedAt(inProgressSession.startedAt)
    setInitialQuestionIndex(0)
    setAppData((current) => current
      ? { ...current, inProgressSession }
      : current)
    setView('question')
  }

  const saveSession = async (
    results: QuestionResult[],
    metadata?: Pick<InProgressSession, 'sessionId' | 'startedAt' | 'grade'>,
  ) => {
    const activeSession = metadata ?? (
      sessionId && sessionStartedAt && appData.profile
        ? { sessionId, startedAt: sessionStartedAt, grade: appData.profile.grade }
        : null
    )
    if (!activeSession) {
      setView('save-error')
      return
    }
    setView('saving')
    try {
      const completion = await saveCompletedLearningSession(repository, {
        sessionId: activeSession.sessionId,
        grade: activeSession.grade,
        startedAt: activeSession.startedAt,
        completedAt: new Date().toISOString(),
        results,
      })
      setAppData(await repository.getAppData())
      setCompletedSession(completion)
      setView('result')
    } catch {
      setView('save-error')
    }
  }

  const completeSession = (results: QuestionResult[]) => {
    setSessionResults(results)
    void saveSession(results)
  }

  const saveProgress = async (
    currentQuestionIndex: number,
    results: QuestionResult[],
  ) => {
    if (!sessionId || !sessionStartedAt || !appData.profile) {
      throw new Error('途中セッション情報がありません。')
    }
    const inProgressSession: InProgressSession = {
      sessionId,
      startedAt: sessionStartedAt,
      grade: appData.profile.grade,
      questions,
      currentQuestionIndex,
      results,
    }
    await repository.saveInProgressSession(inProgressSession)
    setSessionResults(results)
    setAppData((current) => current
      ? { ...current, inProgressSession }
      : current)
  }

  const resumeSession = () => {
    const inProgress = appData.inProgressSession
    if (!inProgress) return
    setQuestions(inProgress.questions)
    setSessionResults(inProgress.results)
    setSessionId(inProgress.sessionId)
    setSessionStartedAt(inProgress.startedAt)
    setInitialQuestionIndex(inProgress.currentQuestionIndex)
    setCompletedSession(null)
    if (inProgress.currentQuestionIndex >= inProgress.questions.length) {
      void saveSession(inProgress.results, inProgress)
      return
    }
    setView('question')
  }

  if (view === 'profile-select') {
    return (
      <ProfileSelectPage
        profiles={appData.profiles}
        selectingProfileId={selectingProfileId}
        error={profileSelectError}
        onSelect={(profileId) => void selectProfile(profileId)}
        onAdd={() => setView('setup')}
      />
    )
  }
  if (view === 'setup') {
    return (
      <SetupPage
        repository={repository}
        onComplete={(profile) => void handleSetupComplete(profile)}
        onCancel={appData.profiles.length > 0 ? () => setView('profile-select') : undefined}
      />
    )
  }
  if (!appData.profile) {
    return (
      <ProfileSelectPage
        profiles={appData.profiles}
        selectingProfileId={selectingProfileId}
        error={profileSelectError}
        onSelect={(profileId) => void selectProfile(profileId)}
        onAdd={() => setView('setup')}
      />
    )
  }
  if (view === 'question') {
    return (
      <QuestionPage
        key={sessionId}
        questions={questions}
        initialQuestionIndex={initialQuestionIndex}
        initialResults={sessionResults}
        onProgress={saveProgress}
        onComplete={completeSession}
        onHome={() => setView('home')}
      />
    )
  }
  if (view === 'saving') return <SaveStatusPage status="saving" />
  if (view === 'save-error') return <SaveStatusPage status="error" onRetry={() => void saveSession(sessionResults)} />
  if (view === 'result') {
    return (
      <ResultPage
        results={sessionResults}
        earnedPoints={completedSession?.session.earnedPoints ?? 0}
        newlyUnlockedTownItemIds={completedSession?.newlyUnlockedTownItemIds ?? []}
        onTown={() => setView('home')}
        onFinish={() => setView('home')}
      />
    )
  }
  if (view === 'parent') {
    return (
      <ParentProgressPage
        appData={appData}
        onBack={() => setView('home')}
      />
    )
  }
  return (
    <HomePage
      profile={appData.profile}
      rewardState={appData.rewardState}
      townState={appData.townState}
      sessions={appData.sessions}
      skillProgress={appData.skillProgress}
      inProgressSession={appData.inProgressSession}
      startError={startError}
      isStarting={isStarting}
      onStart={() => void startSession()}
      onResume={resumeSession}
      onParent={() => setView('parent')}
      onSwitchProfile={() => setView('profile-select')}
    />
  )
}
