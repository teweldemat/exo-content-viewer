import { JSDOM } from 'jsdom'

const marker = '__cpContentViewerJsdom'

/**
 * Installs jsdom globals once per process, like cp-lib's DOM tests do. The instance is kept on
 * globalThis because the preload and each test bundle carry their own copy of this module.
 *
 * This module must not import React: react-dom decides `canUseDOM` (and with it whether it trusts
 * native `input` events) when it is first evaluated, so the globals have to exist before that.
 */
export function installDom(): JSDOM {
  const existing = (globalThis as Record<string, unknown>)[marker] as JSDOM | undefined
  if (existing) return existing
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
  const domWindow = dom.window as unknown as Window & typeof globalThis
  const globals: Record<string, unknown> = {
    window: domWindow,
    document: domWindow.document,
    navigator: domWindow.navigator,
    Element: domWindow.Element,
    HTMLElement: domWindow.HTMLElement,
    HTMLInputElement: domWindow.HTMLInputElement,
    HTMLSelectElement: domWindow.HTMLSelectElement,
    HTMLIFrameElement: domWindow.HTMLIFrameElement,
    SVGElement: domWindow.SVGElement,
    Node: domWindow.Node,
    Text: domWindow.Text,
    Event: domWindow.Event,
    MouseEvent: domWindow.MouseEvent,
    KeyboardEvent: domWindow.KeyboardEvent,
    MutationObserver: domWindow.MutationObserver,
    getComputedStyle: domWindow.getComputedStyle.bind(domWindow),
    requestAnimationFrame: domWindow.requestAnimationFrame.bind(domWindow),
    cancelAnimationFrame: domWindow.cancelAnimationFrame.bind(domWindow),
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
  ;(globalThis as Record<string, unknown>)[marker] = dom
  return dom
}
