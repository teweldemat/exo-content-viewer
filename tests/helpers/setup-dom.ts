/**
 * Preloaded by scripts/run-tests.mjs through `node --import` so jsdom globals exist before react-dom
 * evaluates (react-dom decides `canUseDOM` and input-event support at module load time).
 * Only jsdom-globals.ts may be imported here; anything that pulls in React would defeat the purpose.
 */
import { installDom } from './jsdom-globals.js'

installDom()
