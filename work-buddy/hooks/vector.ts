// Desktop, VS Code and mobile art: one SVG per mode, animated with CSS.

import type { BuddyMode } from '../types'

const ORANGE = '#D97757'
const SHADE = '#B9603F'
const INK = '#2A211C'

const body = (eyes: string) => `
  <g class="body">
    <rect class="leg l1" x="40" y="78" width="7" height="14" rx="3" fill="${SHADE}"/>
    <rect class="leg l2" x="53" y="78" width="7" height="14" rx="3" fill="${SHADE}"/>
    <rect class="leg l3" x="68" y="78" width="7" height="14" rx="3" fill="${SHADE}"/>
    <rect class="leg l4" x="81" y="78" width="7" height="14" rx="3" fill="${SHADE}"/>
    <rect class="arm al" x="20" y="54" width="16" height="9" rx="4.5" fill="${ORANGE}"/>
    <rect class="arm ar" x="92" y="54" width="16" height="9" rx="4.5" fill="${ORANGE}"/>
    <rect x="32" y="26" width="64" height="56" rx="16" fill="${ORANGE}"/>
    <rect x="32" y="66" width="64" height="16" rx="8" fill="${SHADE}" opacity=".35"/>
    ${eyes}
  </g>`

const openEyes = `
    <g class="eyes">
      <rect x="47" y="44" width="8" height="12" rx="3" fill="${INK}"/>
      <rect x="73" y="44" width="8" height="12" rx="3" fill="${INK}"/>
      <rect x="49" y="46" width="3" height="3" rx="1" fill="#fff" opacity=".8"/>
      <rect x="75" y="46" width="3" height="3" rx="1" fill="#fff" opacity=".8"/>
    </g>`

const closedEyes = `
    <g class="eyes">
      <path d="M46 52 q5 5 10 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M72 52 q5 5 10 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>`

const gear = `
  <g class="icon" transform="translate(110 22)">
    <g class="spin">
      <circle r="9" fill="none" stroke="#F5C451" stroke-width="5" stroke-dasharray="4.2 2.8"/>
      <circle r="4" fill="#F5C451"/>
    </g>
  </g>`

const bubble = `
  <g class="icon" transform="translate(110 20)"><g class="bob">
    <rect x="-13" y="-13" width="26" height="22" rx="7" fill="#F3EDE6" stroke="${SHADE}" stroke-width="1.5"/>
    <path d="M-4 9 l2 6 l5 -6 z" fill="#F3EDE6"/>
    <text x="0" y="4" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="15" fill="${SHADE}">?</text>
  </g></g>`

const zzz = `
  <g font-family="sans-serif" font-weight="700" fill="#8FB8E8">
    <text class="z z1" x="102" y="30" font-size="11">z</text>
    <text class="z z2" x="110" y="22" font-size="14">z</text>
    <text class="z z3" x="119" y="12" font-size="17">Z</text>
  </g>`

const CSS: Record<BuddyMode, string> = {
  working: `
    .al { animation: tap .32s ease-in-out infinite alternate; }
    .ar { animation: tap .32s ease-in-out infinite alternate-reverse; }
    @keyframes tap { from { transform: translateY(-6px) } to { transform: translateY(5px) } }
    .body { animation: hop .64s ease-in-out infinite; }
    @keyframes hop { 50% { transform: translateY(-2px) } }
    .spin { animation: spin 1.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg) } }`,
  waiting: `
    .eyes { animation: look 2.4s ease-in-out infinite; }
    @keyframes look { 0%,40% { transform: translateX(-4px) } 50%,90% { transform: translateX(4px) } 100% { transform: translateX(-4px) } }
    .l4 { animation: foot .5s ease-in-out infinite alternate; transform-origin: 50% 0%; }
    @keyframes foot { to { transform: rotate(-18deg) } }
    .bob { animation: bob 1.2s ease-in-out infinite; }
    @keyframes bob { 50% { transform: translateY(-4px) } }`,
  resting: `
    .body { animation: breathe 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
    @keyframes breathe { 50% { transform: scale(1.03, .94) } }
    .z { opacity: 0; animation: float 3s ease-in infinite; }
    .z2 { animation-delay: 1s } .z3 { animation-delay: 2s }
    @keyframes float { 0% { opacity: 0; transform: translateY(6px) } 30% { opacity: 1 } 100% { opacity: 0; transform: translateY(-8px) } }`,
}

/** The SVG document for `mode`. */
export function svg(mode: BuddyMode): string {
  const eyes = mode === 'resting' ? closedEyes : openEyes
  const icon = mode === 'working' ? gear : mode === 'waiting' ? bubble : zzz
  const arms =
    mode === 'working' ? '' : '.arm { transform: translateY(8px) rotate(0deg) }'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 136 100" width="136" height="100">
  <style>
    g, rect, path, text { transform-box: fill-box; }
    .spin { transform-origin: center; }
    ${arms}
    ${CSS[mode]}
  </style>
  <ellipse cx="64" cy="94" rx="34" ry="4" fill="#000" opacity=".12"/>
  ${body(eyes)}
  ${icon}
</svg>`
}
