import { atom, read, update } from 'claude-code'
import type { Register, EngineInterface, RenderInput } from 'claude-code'

import type { Activity, BuddyMode } from '../types'
import { cells, columnsFor } from './pixel'
import { aspect, svg } from './vector'

/** Waiting this long with nobody needed turns into resting. */
const RESTING_AFTER_MS = 2 * 60 * 1000
/** One animation step in the terminal. */
const STEP_MS = 350
/** work-buddy's own pane, for surfaces without the band (or /work-buddy). */
const OWN_PANE = 'work-buddy'
/** Surfaces that draw the AbovePrompt band. */
const HAS_BAND: readonly string[] = ['terminal', 'desktop']

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

/** What the buddy shows at `now`: waiting long enough with nobody needed is resting. */
function shown(a: Activity, now: number): { mode: BuddyMode; detail: string | null } {
  const idle = a.mode === 'waiting' && !a.needsYou && now - a.since > RESTING_AFTER_MS
  return idle ? { mode: 'resting', detail: null } : { mode: a.mode, detail: a.detail }
}

/**
 * The time in a mode as the desktop, VS Code and mobile show it: whole minutes,
 * so their text changes at most once a minute and the picture, which animates
 * itself, is not redrawn (and restarted) every second.
 */
function roughly(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000))
  if (m < 1) return '<1m'
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

function ago(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const startedAt = await $.clock.now()
    await update($, activity, (): Activity => ({ mode: 'resting', since: startedAt, detail: null, needsYou: false }))
    // The terminal's pixel art and seconds timer are redrawn by the module at
    // every step. Elsewhere the picture animates itself, and a redraw can jump
    // it: redraw only when what those surfaces show changes (the waiting →
    // resting change or the minutes), which a change of activity does by itself.
    let shownKey = ''
    $.clock.every(STEP_MS, () => {
      void Promise.all([$.session.surfaces(), read($, activity), $.clock.now()]).then(([list, a, now]) => {
        if (list.includes('terminal')) return $.ui.invalidate('ui.render')
        const s = shown(a, now)
        const key = `${s.mode}|${roughly(now - a.since)}`
        if (key === shownKey) return
        shownKey = key
        $.ui.invalidate('ui.render')
      })
    })
    await $.command.register({ name: 'work-buddy', description: 'Open the work buddy pane' })
    // The band above the prompt is drawn on the terminal and desktop only;
    // where a surface has no band (VS Code, mobile), open a pane instead.
    $.clock.after(1500, () => {
      void $.session.surfaces().then(list => {
        if (list.some(s => !HAS_BAND.includes(s))) void $.ui.open({ id: OWN_PANE, title: 'Work buddy' })
      })
    })
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

  on("command.run", { command: "work-buddy" }, async $ => {
    await $.ui.open({ id: OWN_PANE, title: "Work buddy" })
    return { text: "Work buddy pane opened." }
  })

  on("session.attach", async ($, e, next) => {
    if (!HAS_BAND.includes(e.surface)) void $.ui.open({ id: OWN_PANE, title: "Work buddy" })
    return next(e)
  })

  // The band directly above the prompt: always drawn, at any width.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    return buddy($, e, true)
  })

  // Its own pane: VS Code and mobile, which have no band, or /work-buddy.
  on("ui.render", { component: "Pane", requestId: OWN_PANE }, async ($, e) => buddy($, e, false))
}

async function buddy($: EngineInterface, e: RenderInput<"Pane" | "AbovePrompt">, isSmall: boolean) {
  const [a, now] = await Promise.all([read($, activity), $.clock.now()])
  const { mode, detail } = shown(a, now)
  const look = LOOK[mode]

  const { Box, Text } = $.ui.resolve(e)
  const words = (
    <Box flexDirection="column">
      {e.surface === "terminal" && (
        <Text bold color={look.color}>
          {look.icon} {look.label}
        </Text>
      )}
      {detail !== null && <Text dimColor>{detail}</Text>}
      <Text dimColor>for {e.surface === "terminal" ? ago(now - a.since) : roughly(now - a.since)}</Text>
    </Box>
  )

  let art
  if (e.surface === "terminal") {
    const { Raster } = $.ui.resolve(e)
    const t = Math.floor(now / STEP_MS)
    // The band gives what rows the screen has left; a pane has room for more.
    const room = e.component === "AbovePrompt" ? e.props.maxRows : 8
    const rows = Math.max(5, Math.min(8, room)) // under 5 rows the picture is a blob
    art = <Raster key="buddy" columns={columnsFor(mode, rows)} rows={rows} cells={cells(mode, rows, t)} />
  } else {
    const { Svg } = $.ui.resolve(e)
    art = <Svg key="buddy" source={svg(mode, now)} alt={`Claude is ${look.label.toLowerCase()}`} width={Math.round((isSmall ? 110 : 200) * aspect(mode))} height={isSmall ? 110 : 200} />
  }

  return (
    <Box flexDirection="row" gap={2}>
      {art}
      {words}
    </Box>
  )
}
