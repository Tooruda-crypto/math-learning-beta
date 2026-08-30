import { useRef, useState } from 'react'
import { SpaceIcon, SpaceRobot } from '../components/SpaceIcon'
import type { LearningQuestion, QuestionAnswer } from '../domain/questions/types'
import type { QuestionResult } from '../types/app'

type AnswerPhase = 'first' | 'retry' | 'answered'
type Feedback = 'correct' | 'retry' | 'incorrect' | null

interface QuestionPageProps {
  questions: LearningQuestion[]
  onComplete: (results: QuestionResult[]) => void
  onHome?: () => void
  onProgress?: (currentQuestionIndex: number, results: QuestionResult[]) => Promise<void>
  initialQuestionIndex?: number
  initialResults?: QuestionResult[]
  now?: () => number
}

export function QuestionPage({
  questions,
  onComplete,
  onHome,
  onProgress = async () => undefined,
  initialQuestionIndex = 0,
  initialResults = [],
  now = Date.now,
}: QuestionPageProps) {
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex)
  const [selectedAnswer, setSelectedAnswer] = useState<QuestionAnswer | null>(null)
  const [phase, setPhase] = useState<AnswerPhase>('first')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [showHint, setShowHint] = useState(false)
  const [results, setResults] = useState<QuestionResult[]>(initialResults)
  const [firstResponseTimeMs, setFirstResponseTimeMs] = useState<number | null>(null)
  const [progressSaving, setProgressSaving] = useState(false)
  const [progressError, setProgressError] = useState(false)
  const questionStartedAt = useRef(now())

  const question = questions[questionIndex]
  const isLastQuestion = questionIndex === questions.length - 1
  const presentationType = question.presentationType ?? 'calculation'

  function createResult(retryCorrect: boolean | null, responseTimeMs: number): QuestionResult {
    return {
      questionId: question.id,
      skillId: question.skillId,
      question: question.prompt,
      correctAnswer: String(question.correctAnswer),
      selectedAnswer: String(selectedAnswer),
      firstAttemptCorrect: phase === 'first',
      retryCorrect,
      responseTimeMs,
      answeredAt: new Date(now()).toISOString(),
    }
  }

  async function finishAnswer(result: QuestionResult, nextFeedback: Feedback) {
    const nextResults = [...results, result]
    setProgressSaving(true)
    setProgressError(false)
    try {
      await onProgress(Math.min(questionIndex + 1, questions.length), nextResults)
    } catch {
      setProgressError(true)
      setProgressSaving(false)
      return
    }
    setResults(nextResults)
    setFeedback(nextFeedback)
    setPhase('answered')
    setShowHint(nextFeedback === 'incorrect')
    setProgressSaving(false)
  }

  async function submitAnswer() {
    if (phase === 'answered') {
      const completedResults = results
      if (isLastQuestion) {
        onComplete(completedResults)
        return
      }
      setQuestionIndex((current) => current + 1)
      setSelectedAnswer(null)
      setPhase('first')
      setFeedback(null)
      setShowHint(false)
      setFirstResponseTimeMs(null)
      questionStartedAt.current = now()
      return
    }

    if (selectedAnswer === null) return
    const isCorrect = selectedAnswer === question.correctAnswer

    if (phase === 'first') {
      const responseTimeMs = Math.max(0, now() - questionStartedAt.current)
      setFirstResponseTimeMs(responseTimeMs)
      if (isCorrect) {
        await finishAnswer(createResult(null, responseTimeMs), 'correct')
      } else {
        setSelectedAnswer(null)
        setFeedback('retry')
        setPhase('retry')
        setShowHint(true)
      }
      return
    }

    await finishAnswer(
      createResult(isCorrect, firstResponseTimeMs ?? 0),
      isCorrect ? 'correct' : 'incorrect',
    )
  }

  async function returnHome() {
    setProgressSaving(true)
    setProgressError(false)
    try {
      await onProgress(results.length, results)
      onHome?.()
    } catch {
      setProgressError(true)
      setProgressSaving(false)
    }
  }

  function feedbackMessage(): string {
    if (feedback === 'correct') return 'せいかい！'
    if (feedback === 'retry') return 'もういちど考えてみよう'
    if (feedback === 'incorrect') return `こたえは ${question.correctAnswer} だよ`
    return ''
  }

  return (
    <main className="learning-shell">
      <header className="learning-header">
        {onHome && (
          <button
            className="learning-home"
            type="button"
            disabled={progressSaving}
            onClick={() => void returnHome()}
          >
            <span aria-hidden="true">←</span> ホーム
          </button>
        )}
        <span className="learning-count"><strong>{questionIndex + 1}</strong> / {questions.length}</span>
        <div className="learning-progress" aria-label={`${questions.length}もん中${questionIndex + 1}もん目`}>
          <span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
        </div>
      </header>
      <section
        className={`question-card question-card--${presentationType}`}
        aria-labelledby="question-title"
      >
        <div className="holo-rings" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <SpaceIcon className="question-planet" variant={0} />
        <span className="question-star question-star--one" aria-hidden="true">✦</span>
        <span className="question-star question-star--two" aria-hidden="true">✧</span>
        <span className="question-label">もんだい</span>
        <h1 id="question-title">{question.prompt}</h1>
        <div className="answer-grid" role="group" aria-label="答えを選ぶ">
          {question.choices.map((choice) => {
            const isSelected = selectedAnswer === choice.value
            const isCorrectAnswer = phase === 'answered' && choice.value === question.correctAnswer
            const isIncorrectAnswer = phase === 'answered' && isSelected && !isCorrectAnswer
            const classes = [
              'answer-choice',
              isSelected ? 'is-selected' : '',
              isCorrectAnswer ? 'is-correct' : '',
              isIncorrectAnswer ? 'is-incorrect' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={choice.id}
                className={classes}
                type="button"
                aria-pressed={isSelected}
                disabled={phase === 'answered'}
                onClick={() => setSelectedAnswer(choice.value)}
              >
                {choice.label}
              </button>
            )
          })}
        </div>

        {feedback && (
          <p className={`answer-feedback answer-feedback--${feedback}`} role="status">
            {feedback === 'correct' && <span className="correct-sparkles" aria-hidden="true">✦ ✧ ✦</span>}
            {feedback === 'retry' && <SpaceRobot className="mini-robot" />}
            {feedbackMessage()}
          </p>
        )}
        {progressError && (
          <p className="answer-feedback answer-feedback--incorrect" role="alert">
            つづきを保存できませんでした。もう一度「答えを決める」を押してください。
          </p>
        )}

        <div className="question-actions">
          <button className="hint-button" type="button" onClick={() => setShowHint((current) => !current)}>
            <span aria-hidden="true">?</span> ヒント
          </button>
          <button
            className="button button--primary question-submit"
            type="button"
            disabled={progressSaving || (phase !== 'answered' && selectedAnswer === null)}
            onClick={() => void submitAnswer()}
          >
            {progressSaving
              ? '保存しています…'
              : phase === 'answered'
                ? (isLastQuestion ? 'けっかをみる' : 'つぎのもんだい')
                : '答えを決める'}
          </button>
        </div>
        {showHint && (
          <div className="hint-panel" role="status">
            <SpaceRobot className="hint-robot" />
            <p>{question.hint}</p>
          </div>
        )}
      </section>
    </main>
  )
}
