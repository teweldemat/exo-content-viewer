import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Toolbar slot provided by `ContentViewer`. When present, renderer controls are portaled into the
 * viewer's single toolbar row instead of stacking a second bar above the content.
 */
export const RendererBarSlotContext = createContext<HTMLElement | null>(null)

/** Renderer controls: portaled into the viewer toolbar when one exists, otherwise a bar of their own. */
export function RendererBar({ children }: { children: ReactNode }) {
  const slot = useContext(RendererBarSlotContext)
  if (slot) return createPortal(<>{children}</>, slot)
  return <div className="cv-bar">{children}</div>
}
