export type BuddyMode = 'working' | 'waiting' | 'resting'

export type Activity = {
  /** What Claude is doing; 'waiting' past RESTING_AFTER_MS draws as resting. */
  mode: BuddyMode
  /** When this mode began, ms since the epoch. */
  since: number
  /** A short word on what: a tool's name, "permission", "your reply". */
  detail: string | null
  /** True while a person must act (a permission prompt or a question). */
  needsYou: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'work-buddy': { activity: Shaped<Activity> }
  }
}
