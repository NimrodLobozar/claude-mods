# claude-mods

My own mods for Claude Code. Each folder is one mod; `.claude-plugin/marketplace.json` lists them all, so this repository works as a plugin marketplace.

## Mods

| Mod | What it does |
| --- | --- |
| [usage-timer](usage-timer) | A side pane with a session timer, a live timer for the running turn, the context window's fill (bar, tokens used and left), the session's cost and rate-limit usage. Opens at session start in a wide terminal, otherwise with your first prompt; `/usage-timer` reopens it. |
| [work-buddy](work-buddy) | An animated character in the band right above the prompt (terminal and desktop app, any width): ⚙ working (thinking or running a tool), ⏳ waiting (a permission prompt, a question, or your reply) and 💤 resting (idle for 2 minutes). Vector art (SVG) in the desktop app, pixel art in the terminal. In VS Code and mobile, which have no band, it opens its own pane; `/work-buddy` opens that pane anywhere. |

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

This repository is public, so anyone can install from it; no GitHub account or login is needed.

## Changing work-buddy's art

The pictures are `work-buddy/art/claude-working.svg`, `claude-waiting.svg` and `claude-sleeping.svg` (resting), each an SVG wrapping one PNG; `work-buddy/art/parts-sheet.webp` is the sheet of separate parts they were drawn from.

In the desktop app, VS Code and mobile each pose is animated part by part: the PNG is cut into layers (body, hair, hands, eyes, the laptop's stripes and glow, the speech bubble and its dots, the Z's) and each layer moves on its own, with no bounce and no status pill. Three Python scripts do the cutting and write `work-buddy/hooks/working-art.ts`, `waiting-art.ts` and `sleeping-art.ts`:

```bash
pip install pillow numpy scipy
python work-buddy/art/build-working.py
python work-buddy/art/build-waiting.py
python work-buddy/art/build-sleeping.py
```

The desktop app restarts the picture about once a second while usage-timer's pane ticks, so every steady motion repeats exactly every second (a restart then lands on the same frame). An occasional moment, such as a blink, starts after a few still seconds, so it never shows while those restarts happen and nothing jumps.

The terminal's pixel art (and the fallback for the desktop) comes from `work-buddy/hooks/art.ts`; rebuild it after replacing the pictures:

```bash
npm install --no-save sharp
node work-buddy/art/build.cjs
```

## Adding a mod

Put the mod in its own folder (`<mod>/.claude-plugin/plugin.json`, `<mod>/hooks/...`) and add an entry to `.claude-plugin/marketplace.json` with `"source": "./<mod>"`.
