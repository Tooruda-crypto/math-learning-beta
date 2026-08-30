interface SaveStatusPageProps {
  status: 'saving' | 'error'
  onRetry?: () => void
}

export function SaveStatusPage({ status, onRetry }: SaveStatusPageProps) {
  const isSaving = status === 'saving'
  return (
    <main className="save-status-shell">
      <section className="save-status-card" aria-live="polite">
        <div className={isSaving ? 'save-status-icon is-saving' : 'save-status-icon is-error'} aria-hidden="true">
          {isSaving ? '…' : '!'}
        </div>
        <h1>{isSaving ? '学習結果を保存しています' : '学習結果を保存できませんでした'}</h1>
        <p>
          {isSaving
            ? 'そのまま少し待ってね。'
            : '通信は使っていません。もう一度保存をためしてね。'}
        </p>
        {!isSaving && (
          <button className="button button--primary" type="button" onClick={onRetry}>
            もう一度保存する
          </button>
        )}
      </section>
    </main>
  )
}
