// Terminal art: the character from art/*.svg, scaled to the rows the band
// has, drawn into a Raster with two pixels per cell (the upper-half block:
// foreground = top pixel, background = bottom pixel).

import type { BuddyMode } from '../types'
import { ART } from './art'

const DEFAULT = 0x01000000 // the terminal's own color

type Pixels = { width: number; height: number; data: Uint8Array }

const decoded = new Map<BuddyMode, Pixels>()
function source(mode: BuddyMode): Pixels {
  let px = decoded.get(mode)
  if (!px) {
    const t = ART[mode].terminal
    px = { width: t.width, height: t.height, data: fromBase64(t.rgba) }
    decoded.set(mode, px)
  }
  return px
}

/** Area-averages `src` down to `w`×`h`; a pixel under half covered is empty. */
function scale(src: Pixels, w: number, h: number): number[] {
  const out: number[] = new Array(w * h).fill(DEFAULT)
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * src.height) / h), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * src.height) / h))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * src.width) / w), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * src.width) / w))
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.width + sx) * 4
          const alpha = src.data[i + 3]!
          r += src.data[i]! * alpha
          g += src.data[i + 1]! * alpha
          b += src.data[i + 2]! * alpha
          a += alpha
          n++
        }
      if (n === 0 || a / n < 128) continue
      out[y * w + x] = (Math.round(r / a) << 16) | (Math.round(g / a) << 8) | Math.round(b / a)
    }
  }
  return out
}

/** The columns a picture `rows` tall takes. */
export function columnsFor(mode: BuddyMode, rows: number): number {
  const src = source(mode)
  return Math.max(1, Math.round((src.width * rows * 2) / src.height))
}

/**
 * The Raster's `cells` for `mode`, `rows` tall, at animation step `t`, base64:
 * the picture is one pixel shorter than the box and bobs within it.
 */
export function cells(mode: BuddyMode, rows: number, t: number): string {
  const columns = columnsFor(mode, rows)
  const h = rows * 2
  const picture = scale(source(mode), columns, h - 1)
  const period = mode === 'working' ? 1 : mode === 'waiting' ? 3 : 5
  const dy = Math.floor(t / period) % 2
  const at = (x: number, y: number) => {
    const sy = y - dy
    return sy < 0 || sy >= h - 1 ? DEFAULT : picture[sy * columns + x]!
  }
  const words = new Uint32Array(columns * rows * 3)
  for (let r = 0; r < rows; r++)
    for (let x = 0; x < columns; x++) {
      const top = at(x, r * 2)
      const bottom = at(x, r * 2 + 1)
      const i = (r * columns + x) * 3
      if (top === DEFAULT && bottom === DEFAULT) words.set([0x20, DEFAULT, DEFAULT], i)
      else if (top === DEFAULT) words.set([0x2584, bottom, DEFAULT], i) // ▄
      else words.set([0x2580, top, bottom], i) // ▀
    }
  return toBase64(new Uint8Array(words.buffer))
}

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function toBase64(bytes: Uint8Array): string {
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
function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (ABC.indexOf(clean[i]!) << 18) |
      (ABC.indexOf(clean[i + 1] ?? 'A') << 12) |
      (ABC.indexOf(clean[i + 2] ?? 'A') << 6) |
      ABC.indexOf(clean[i + 3] ?? 'A')
    if (o < out.length) out[o++] = (n >> 16) & 255
    if (o < out.length) out[o++] = (n >> 8) & 255
    if (o < out.length) out[o++] = n & 255
  }
  return out
}
