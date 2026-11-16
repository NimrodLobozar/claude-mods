// Desktop, VS Code and mobile art: the SVGs from art/*.svg, shrunk to fit.

import type { BuddyMode } from '../types'
import { ART } from './art'

/** The SVG document for `mode`. */
export function svg(mode: BuddyMode): string {
  return ART[mode].desktop
}

/** Its width over its height. */
export function aspect(mode: BuddyMode): number {
  return ART[mode].desktopWidth / ART[mode].desktopHeight
}
