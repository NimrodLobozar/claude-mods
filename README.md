# claude-mods

My own mods for Claude Code. Each folder is one mod; `.claude-plugin/marketplace.json` lists them all, so this repository works as a plugin marketplace.

## Mods

| Mod | What it does |
| --- | --- |
| [usage-timer](usage-timer) | A side pane with a session timer, a live timer for the running turn, the context window's fill (bar, tokens used and left), the session's cost and rate-limit usage. Opens at session start; `/usage-timer` reopens it. |
| [work-buddy](work-buddy) | An animated character at the top of the usage-timer pane: ⚙ working (thinking or running a tool), ⏳ waiting (a permission prompt, a question, or your reply) and 💤 resting (idle for 2 minutes). Vector art (SVG) in the desktop app, VS Code and mobile; pixel art in the terminal. Draws on top of the usage-timer pane when that mod is loaded; otherwise opens its own pane (`/work-buddy` reopens it). |

## Install

At the prompt of a terminal Claude Code session:

```
/plugin install usage-timer --marketplace NimrodLobozar/claude-mods
```

```
/plugin install work-buddy --marketplace NimrodLobozar/claude-mods
```

Answer `y` to add the marketplace, then pick the user scope with Enter.

From a shell:

```bash
claude plugin install usage-timer --marketplace NimrodLobozar/claude-mods
claude plugin install work-buddy --marketplace NimrodLobozar/claude-mods
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `NimrodLobozar/claude-mods`, then Add plugin.

This repository is private: the machine you install on needs a git credential for github.com that can read it, for example `gh auth login` followed by `gh auth setup-git`. The install never prompts for one.

## Adding a mod

Put the mod in its own folder (`<mod>/.claude-plugin/plugin.json`, `<mod>/hooks/...`) and add an entry to `.claude-plugin/marketplace.json` with `"source": "./<mod>"`.
