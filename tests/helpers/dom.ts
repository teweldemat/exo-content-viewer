import { installDom } from './jsdom-globals.js'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

export { installDom }

export type Rendered = {
  container: HTMLElement
  root: Root
  /** Runs pending effects and async work inside `act`. */
  flush(ms?: number): Promise<void>
  /** Polls until `predicate` returns a truthy value. */
  waitFor<T>(predicate: () => T | null | undefined | false, options?: { timeout?: number; step?: number }): Promise<T>
  unmount(): Promise<void>
}

export async function renderClient(element: ReactElement): Promise<Rendered> {
  const dom = installDom()
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const flush = async (ms = 0) => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms))
    })
  }
  await act(async () => {
    root.render(element)
  })
  const waitFor = async <T,>(predicate: () => T | null | undefined | false, options: { timeout?: number; step?: number } = {}) => {
    const timeout = options.timeout ?? 5000
    const step = options.step ?? 25
    const started = Date.now()
    for (;;) {
      const value = predicate()
      if (value) return value
      if (Date.now() - started > timeout) throw new Error('waitFor timed out')
      await flush(step)
    }
  }
  return {
    container: container as unknown as HTMLElement,
    root,
    flush,
    waitFor,
    unmount: async () => {
      await act(async () => { root.unmount() })
      container.remove()
    },
  }
}

export function renderStatic(element: ReactElement): string {
  return renderToStaticMarkup(element)
}

/**
 * jsdom lays nothing out, so virtualized lists measure a 0x0 scroll container and render no rows.
 * This gives every `data-virtualized` element a fixed rect so TanStack Virtual produces items.
 */
export function stubVirtualizedRects(width = 800, height = 600): void {
  const dom = installDom()
  const prototype = dom.window.HTMLElement.prototype as HTMLElement & { __cvRectStubbed?: boolean }
  if (prototype.__cvRectStubbed) return
  const originalRect = prototype.getBoundingClientRect
  prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.dataset?.virtualized === 'true') {
      return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) } as DOMRect
    }
    return originalRect.call(this)
  }
  // TanStack Virtual measures the scroll element through offsetWidth/offsetHeight.
  for (const [name, size] of [['offsetWidth', width], ['offsetHeight', height]] as const) {
    const original = Object.getOwnPropertyDescriptor(prototype, name)
    Object.defineProperty(prototype, name, {
      configurable: true,
      get(this: HTMLElement) {
        if (this.dataset?.virtualized === 'true') return size
        return original?.get ? original.get.call(this) : 0
      },
    })
  }
  prototype.__cvRectStubbed = true
}

export function click(element: Element): Event {
  const dom = installDom()
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
  element.dispatchEvent(event)
  return event
}

export function changeValue(element: HTMLInputElement | HTMLSelectElement, value: string): void {
  const dom = installDom()
  const prototype = element instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  if (setter) setter.call(element, value)
  else element.value = value
  element.dispatchEvent(new dom.window.Event(element instanceof dom.window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

export function setChecked(element: HTMLInputElement, checked: boolean): void {
  const dom = installDom()
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'checked')?.set
  if (setter) setter.call(element, checked)
  else element.checked = checked
  element.dispatchEvent(new dom.window.Event('click', { bubbles: true }))
}
