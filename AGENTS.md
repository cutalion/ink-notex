# Repository Guidelines

## Project Structure & Module Organization
- `bin/notex.js`: CLI entrypoint (ESM).
- `src/index.js`: Bootstraps Ink render and loads persisted tasks.
- `src/ui.js`: React (Ink) components, input, and interactions.
- `src/persist.js`: JSON storage for `.notex.json` in the working directory.
- `README.md`: Usage and key bindings.
- `.gitignore`: Node, editor, and app data ignores.

No build step; the app runs directly on Node with ESM.

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm start`: Run the CLI (`node bin/notex.js`).
- `npm link`: Add global command `notex` for local development.
- `npm test`: Placeholder for now (configure when tests are added).

## Coding Style & Naming Conventions
- ESM only (`"type": "module"`). Use `import`/`export` and file extensions (e.g., `./ui.js`).
- React Ink without JSX (uses `React.createElement`). Keep components small and focused.
- Indentation: 2 spaces; quotes: single; keep lines concise.
- File names: lowercase, simple (`ui.js`, `persist.js`). Prefer pure helpers in `src/`.

## Testing Guidelines
- Framework not set up yet. Recommended: Vitest + `ink-testing-library`.
- Test files: `src/**/*.test.js`.
- Cover: toggling, add/edit/delete flows, and persistence (use temp dirs, avoid writing real `.notex.json`).
- Example (future): `npm run test` runs unit tests and reports coverage.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- One logical change per commit; imperative mood for subjects.
- PRs must include: clear description, steps to verify, screenshots/GIFs for UI changes, and linked issues.
- Ensure `npm start` works and no unintended files are committed (`.notex.json` is ignored).

## Security & Configuration Tips
- `.notex.json` stores local app data; never commit it.
- No secrets required; `.env` files are ignored by default.
- Use Node 18+; Ink 6 is ESM-only and uses top-level await.
