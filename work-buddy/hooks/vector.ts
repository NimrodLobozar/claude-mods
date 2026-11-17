// Desktop, VS Code and mobile art: the SVGs from art/*.svg, shrunk to fit.
// Each mode is a layered, animated picture from art/build-working.py,
// art/build-waiting.py and art/build-sleeping.py; art.ts is the fallback.

import type { BuddyMode } from '../types'
import { ART } from './art'
import { SLEEPING_HEIGHT, SLEEPING_SVG, SLEEPING_WIDTH } from './sleeping-art'
import { WAITING_HEIGHT, WAITING_SVG, WAITING_WIDTH } from './waiting-art'
import { WORKING_HEIGHT, WORKING_SVG, WORKING_WIDTH } from './working-art'

const ANIMATED: Partial<Record<BuddyMode, { svg: string; width: number; height: number }>> = {
  working: { svg: WORKING_SVG, width: WORKING_WIDTH, height: WORKING_HEIGHT },
  waiting: { svg: WAITING_SVG, width: WAITING_WIDTH, height: WAITING_HEIGHT },
  resting: { svg: SLEEPING_SVG, width: SLEEPING_WIDTH, height: SLEEPING_HEIGHT },
}

/**
 * The SVG document for `mode`, at clock time `now` (ms). A redraw can restart
 * the picture's animations, so each one runs from `--t`: stamped with the time,
 * a restarted picture carries on where the last one was instead of starting over.
 */
export function svg(mode: BuddyMode, now: number): string {
  const a = ANIMATED[mode]
  return a ? a.svg.replace('svg{--t:0ms}', `svg{--t:${Math.floor(now % 3_600_000)}ms}`) : ART[mode].desktop
}

/** Its width over its height. */
export function aspect(mode: BuddyMode): number {
  const a = ANIMATED[mode]
  return a ? a.width / a.height : ART[mode].desktopWidth / ART[mode].desktopHeight
}
