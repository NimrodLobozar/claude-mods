// Terminal art: a 16x12 pixel sprite drawn into a Raster of 16x6 cells,
// two pixels per cell with the upper-half block (fg = top, bg = bottom).

import type { BuddyMode } from '../types'

const DEFAULT = 0x01000000 // the terminal's own color
const PALETTE: Record<string, number> = {
  O: 0xd97757, // Claude orange
  D: 0xa8553a, // shade
  K: 0x1f1a17, // eyes
  Y: 0xf5c451, // spark
  B: 0x8fb8e8, // zzz
  W: 0xf3ede6, // ? mark
}

export const COLUMNS = 16
export const ROWS = 6

const BASE = [
  '................',
  '....OOOOOOOO....',
  '...OOOOOOOOOO...',
  '..OOOOOOOOOOOO..',
  '..OOOKKOOKKOOO..',
  '..OOOKKOOKKOOO..',
  '..OOOOOOOOOOOO..',
  '..OOOOOOOOOOOO..',
  '..OOOOOOOOOOOO..',
  '...DOOOOOOOOD...',
  '...O.O....O.O...',
  '...O.O....O.O...',
]

type Grid = string[][]

const grid = (): Grid => BASE.map(row => row.split(''))
const put = (g: Grid, x: number, y: number, c: string) => {
  const row = g[y]
  if (row && x >= 0 && x < COLUMNS) row[x] = c
}
const eyes = (g: Grid, dx: number, closed: boolean) => {
  for (const y of [4, 5]) for (let x = 2; x < 14; x++) put(g, x, y, 'O')
  if (closed) {
    for (const x of [5, 6, 9, 10]) put(g, x, 5, 'K')
    return
  }
  for (const y of [4, 5]) for (const x of [5, 6, 9, 10]) put(g, x + dx, y, 'K')
}

function frame(mode: BuddyMode, t: number): Grid {
  let g = grid()
  if (mode === 'working') {
    // Arms typing: up, then down; a spark blinking over the head.
    const up = t % 2 === 0
    put(g, 0, up ? 6 : 8, 'O'), put(g, 1, up ? 6 : 8, 'O')
    put(g, 14, up ? 8 : 6, 'O'), put(g, 15, up ? 8 : 6, 'O')
    eyes(g, 0, false)
    if (t % 4 < 2) put(g, 14, 0, 'Y'), put(g, 13, 1, 'Y'), put(g, 15, 1, 'Y')
    else put(g, 14, 1, 'Y')
  } else if (mode === 'waiting') {
    // Looking left and right, tapping a foot, a ? over the head.
    const look = t % 8 < 4 ? -1 : 1
    eyes(g, look, false)
    put(g, 0, 8, 'O'), put(g, 1, 8, 'O'), put(g, 14, 8, 'O'), put(g, 15, 8, 'O')
    if (t % 2 === 0) put(g, 10, 11, '.'), put(g, 12, 11, '.')
    for (const [x, y] of [[13, 0], [14, 0], [15, 1], [14, 2]] as const) put(g, x, y, 'W')
  } else {
    // Eyes shut, breathing (sinks a row), a z drifting up.
    eyes(g, 0, true)
    if (t % 6 < 3) g = [BASE[0]!.split(''), ...g.slice(0, -2), g[g.length - 1]!]
    const z = 2 - (Math.floor(t / 2) % 3)
    put(g, 13, z, 'B'), put(g, 14, z, 'B')
  }
  return g
}

const color = (c: string | undefined) => (c && PALETTE[c]) || DEFAULT

/** The Raster's `cells` for `mode` at animation step `t`, base64. */
export function cells(mode: BuddyMode, t: number): string {
  const g = frame(mode, t)
  const words = new Uint32Array(COLUMNS * ROWS * 3)
  for (let r = 0; r < ROWS; r++) {
    for (let x = 0; x < COLUMNS; x++) {
      const top = color(g[r * 2]?.[x])
      const bottom = color(g[r * 2 + 1]?.[x])
      const i = (r * COLUMNS + x) * 3
      if (top === DEFAULT && bottom === DEFAULT) words.set([0x20, DEFAULT, DEFAULT], i)
      else if (top === DEFAULT) words.set([0x2584, bottom, DEFAULT], i) // ▄
      else words.set([0x2580, top, bottom], i) // ▀
    }
  }
  return base64(new Uint8Array(words.buffer))
}

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += ABC[(n >> 18) & 63]! + ABC[(n >> 12) & 63]!
    out += b === undefined ? '=' : ABC[(n >> 6) & 63]!
    out += c === undefined ? '=' : ABC[n & 63]!
  }
  return out
}
