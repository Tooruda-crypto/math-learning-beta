export function ScreenMessage({ children }: { children: string }) {
  return <div className="screen-message" role="status">{children}</div>
}
