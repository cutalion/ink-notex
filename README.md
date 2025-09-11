# ink-notex

Interactive TODO CLI built with Ink (React for CLIs).

## Install & Run

- Local run:
  - `npm install`
  - `npm start`
- As a command (link locally):
  - `npm link` then run `notex`

## Keys

- Up/Down: Navigate
- Space: Toggle done
- Enter: Edit item
- a: Add task
- e: Edit task
- d: Delete task
- u / Ctrl+Z: Undo
- r / Ctrl+Y: Redo
- o: Settings (switch storage)
- h / ?: Help
- s: Save now (autosave is on)
- q: Save and quit
- Esc: Cancel input / close help/settings
- Ctrl+C: Press twice quickly to exit

## Data

- Autosaves to the chosen storage location.
- Project storage: `./.notex.json` in the current working directory.
- Global storage: `~/.notex-global.json` in your home directory.
- The app picks a sensible default (project if present, otherwise global).

## Notes

- No JSX or build step; uses `React.createElement` via Ink.

## Provenance

This project was created entirely using Codex CLI, guided by a human.
