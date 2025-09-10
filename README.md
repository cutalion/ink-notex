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
- s: Save to `.notex.json`
- q: Save and quit
- Esc: Cancel input

## Data

- Tasks persist to `.notex.json` in the current working directory.

## Notes

- No JSX or build step; uses `React.createElement` via Ink.

## Provenance

This project was created entirely using Codex CLI, guided by a human.
