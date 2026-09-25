export function LoadingNotice({ label }: { label: string }) {
  return <div className="cv-notice cv-muted" role="status">Loading {label}…</div>
}

export function ErrorNotice({ error, prefix }: { error: Error | string; prefix?: string }) {
  const message = typeof error === 'string' ? error : error.message
  return <div className="cv-notice cv-error-text" role="alert">{prefix ? `${prefix}: ` : ''}{message}</div>
}
