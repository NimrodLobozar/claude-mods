import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface, RenderInput } from 'claude-code'

import type { Activity, BuddyMode } from '../types'
import { cells, COLUMNS, ROWS } from './pixel'
import { svg } from './vector'

/** Waiting this long with nobody needed turns into resting. */
const RESTING_AFTER_MS = 2 * 60 * 1000
/** One animation step in the terminal. */
const STEP_MS = 350

const activity = atom(
  { plugin: 'work-buddy', key: 'activity' } as const,
  { mode: 'resting', since: 0, detail: null, needsYou: false } as Activity,
  { shape: 'activity-1' },
)

async function set($: EngineInterface, next: Omit<Activity, 'since'>) {
  const now = await $.clock.now()
  await update($, activity, old =>
    old.mode === next.mode && old.detail === next.detail && old.needsYou === next.needsYou
      ? old
      : { ...next, since: now },
  )
}

const LOOK: Record<BuddyMode, { icon: string; label: string; color: string }> = {
  working: { icon: '⚙', label: 'Working', color: 'claude' },
  waiting: { icon: '⏳', label: 'Waiting', color: 'warning' },
  resting: { icon: '💤', label: 'Resting', color: 'subtle' },
}

function ago(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await set($, { mode: 'resting', detail: null, needsYou: false })
    // Animation and the waiting → resting change both need the clock.
    $.clock.every(STEP_MS, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await set($, { mode: 'working', detail: 'thinking', needsYou: false })
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.agentId === undefined)
      await set($, { mode: 'waiting', detail: `permission for ${e.tool}`, needsYou: true })
    return verdict
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const asks = e.tool === 'AskUserQuestion'
    await set(
      $,
      asks
        ? { mode: 'waiting', detail: 'your answer', needsYou: true }
        : { mode: 'working', detail: e.tool, needsYou: false },
    )
    const ran = await next(e)
    await set($, { mode: 'working', detail: 'thinking', needsYou: false })
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await set($, { mode: 'waiting', detail: 'your reply', needsYou: false })
    return next(e)
  })

  on(
    'ui.render',
    // The usage-timer mod's pane: work-buddy draws on top of it.
    { component: 'Pane', requestId: 'usage-timer', plugin: 'usage-timer' },
    async ($, matched, next) => {
      // The types narrow a matcher naming another plugin to nothing; it is that plugin's Pane.
      const e = matched as unknown as RenderInput<'Pane'>
      const below = await next(matched)
      const [a, now] = await Promise.all([read($, activity), $.clock.now()])
      const idle = a.mode === 'waiting' && !a.needsYou && now - a.since > RESTING_AFTER_MS
      const mode: BuddyMode = idle ? 'resting' : a.mode
      const look = LOOK[mode]
      const detail = idle ? null : a.detail

      const { Box, Text } = $.ui.resolve(e)
      const words = (
        <Box flexDirection="column">
          <Text bold color={look.color}>
            {look.icon} {look.label}
          </Text>
          {detail !== null && <Text dimColor>{detail}</Text>}
          <Text dimColor>for {ago(now - a.since)}</Text>
        </Box>
      )

      let art
      if (e.surface === "terminal") {
        const { Raster } = $.ui.resolve(e)
        const t = Math.floor(now / STEP_MS)
        art = <Raster key="buddy" columns={COLUMNS} rows={ROWS} cells={cells(mode, t)} />
      } else {
        const { Svg } = $.ui.resolve(e)
        art = <Svg source={svg(mode)} alt={`Claude is ${look.label.toLowerCase()}`} width={136} height={100} />
      }

      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" gap={2}>
            {art}
            {words}
          </Box>
          {below}
        </Box>
      )
    },
  )
}
