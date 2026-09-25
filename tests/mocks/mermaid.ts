/** Test double for `mermaid`, wired in by scripts/run-tests.mjs through an esbuild alias. */
export type MermaidCall = { id: string; definition: string }

export const mermaidMock = {
  calls: [] as MermaidCall[],
  lastConfig: null as Record<string, unknown> | null,
}

const mermaid = {
  initialize(config: Record<string, unknown>) {
    mermaidMock.lastConfig = config
  },
  async render(id: string, definition: string): Promise<{ svg: string }> {
    mermaidMock.calls.push({ id, definition })
    if (/invalid/i.test(definition)) throw new Error('Parse error on line 1: invalid diagram')
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text>${definition.length}</text></svg>` }
  },
}

export default mermaid
