# Emdash Fork

Personal fork of [emdash](https://github.com/generalaction/emdash) — an Agentic Development Environment (Electron desktop app).

## Fork Changes

- **Auto-update disabled** in `src/main/services/AutoUpdateService.ts` — `initialize()` returns immediately without setting up the updater, event listeners, or scheduled checks

## Dev Setup

```bash
# Requires Node 20-22 (not 23+), Python 3.x with setuptools
nvm use 22
pnpm install
pnpm run dev
```

**Python/node-gyp note:** If `node-pty` fails to build with `ModuleNotFoundError: No module named 'distutils'`, install setuptools into the Python that node-gyp finds:
```bash
/usr/local/opt/python@3.14/bin/python3.14 -m pip install setuptools --break-system-packages
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `pnpm run dev` | Dev server (Vite on :3000 + Electron) |
| `pnpm run build` | Production build |
| `pnpm run package:mac` | Package macOS DMG |
| `pnpm run typecheck` | TypeScript check |

## Architecture

- **Electron main process:** `src/main/` — Node.js services (Git, SSH, PTY, DB)
- **React renderer:** `src/renderer/` — UI components, hooks, styles
- **Shared code:** `src/shared/` — Provider registry, skills, types
- **Database:** SQLite + Drizzle ORM, migrations in `drizzle/`
- **IPC:** Clean boundary — all backend access via `ipcRenderer.invoke`

## Sidebar UI Notes

The current `main` branch already has:
- Inline `+` button on project header row (no full-width "New Task" below projects)
- No delete button in sidebar (`onDeleteProject` prop is unused, prefixed `_`)
- Delete is available from the project home page (`ProjectMainView.tsx`)

## Staying in Sync with Upstream

```bash
git fetch upstream
git merge upstream/main
```
