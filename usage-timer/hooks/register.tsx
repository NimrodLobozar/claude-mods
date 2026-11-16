import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { TurnClock } from '../types'

const PANE = 'usage-timer'
const TITLE = 'Usage & timer'

const turn = atom(
  { plugin: 'usage-timer', key: 'turn' } as const,
  { startedAt: null, lastMs: null, count: 0 } as TurnClock,
  { shape: 'turn-1' },
)

const two = (n: number) => String(n).padStart(2, '0')
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${two(m)}:${two(s % 60)}`
}
function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
function bar(percent: number, width: number): string {
  const full = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return '█'.repeat(full) + '░'.repeat(width - full)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-timer',
      description: 'Open the usage & timer pane',
    })
    void $.ui.open({ id: PANE, title: TITLE })
    // Tick once a second so the timers move.
    $.clock.every(1000, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  on('command.run', { command: 'usage-timer' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Usage & timer pane opened.' }
  })

  // A pane opened unasked waits for a wide terminal (144 columns); one opened
  // behind the person's own prompt is placed at any width.
  on('prompt.submit', async ($, e, next) => {
    const pane = (await $.ui.panes()).find(p => p.id === PANE)
    if (!pane?.isPlaced) void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, turn, t => ({ ...t, startedAt: now }))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, turn, t => ({
        startedAt: null,
        lastMs: e.durationMs,
        count: t.count + 1,
      }))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const [usage, now, t] = await Promise.all([
      $.session.usage(),
      $.clock.now(),
      read($, turn),
    ])
    const ctx = usage.context
    const pct = ctx.percent ?? 0
    const pctColor = pct >= 85 ? 'error' : pct >= 60 ? 'warning' : 'success'
    const width = Math.max(10, Math.min(30, (e.viewport?.columns ?? 30) - 8))

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>Timer</Text>
          <Text tabular>Session   {clock(now - usage.startedAt)}</Text>
          {t.startedAt !== null ? (
            <Text tabular color="claude">
              This turn {clock(now - t.startedAt)} ●
            </Text>
          ) : (
            <Text tabular dimColor>
              Last turn {t.lastMs === null ? '—' : clock(t.lastMs)}
            </Text>
          )}
          <Text dimColor>Turns     {t.count}</Text>
        </Box>

        <Box flexDirection="column">
          <Text bold>Context</Text>
          <Text tabular color={pctColor}>
            {bar(pct, width)} {pct}%
          </Text>
          <Text tabular>
            {ctx.tokens === undefined ? '—' : tokens(ctx.tokens)} / {tokens(ctx.window)} tokens
          </Text>
          {ctx.tokens !== undefined && (
            <Text tabular dimColor>
              {tokens(Math.max(0, ctx.window - ctx.tokens))} left
            </Text>
          )}
        </Box>

        {usage.cost !== undefined && (
          <Box flexDirection="column">
            <Text bold>Cost</Text>
            <Text tabular>${usage.cost.usd.toFixed(2)}</Text>
          </Box>
        )}

        {usage.rateLimits.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Rate limits</Text>
            {usage.rateLimits.map(r => (
              <Text tabular dimColor>
                {r.kind === "five_hour" ? "5-hour " : r.kind === "seven_day" ? "7-day  " : r.kind + " "}{bar(r.percentUsed, 10)} {r.percentUsed}%
              </Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
