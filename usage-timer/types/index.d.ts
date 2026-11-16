export type TurnClock = {
  /** When the running main-thread turn began, or null between turns. */
  startedAt: number | null
  /** How long the last finished turn took, in ms. */
  lastMs: number | null
  /** Main-thread turns finished this session. */
  count: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-timer': { turn: Shaped<TurnClock> }
  }
}
