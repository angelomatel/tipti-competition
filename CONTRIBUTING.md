# Contributing

This repo is split into three TypeScript applications that share one tournament domain:

- `frontend/`: Next.js UI and API proxy routes
- `backend/`: Express API, cron orchestration, Riot integration, and database access
- `tipti-clanker/`: Discord bot that talks to the backend over HTTP

The backend is the system of record. Frontend and bot should not reimplement backend business rules or access MongoDB directly.

## Working Agreements

- Keep changes scoped to the owning app unless a cross-app contract really changes.
- Prefer small, reviewable refactors over broad rewrites while the codebase is still moving.
- Preserve existing aliases (`@/`) and package-local boundaries instead of deep relative imports.
- Add comments only when they explain intent, domain rules, or a non-obvious tradeoff.

## TypeScript And Code Style

- Keep `strict` TypeScript assumptions intact. Avoid weakening types to speed up a refactor.
- Prefer explicit types at boundaries:
  - controller inputs and outputs
  - service return values when inference becomes unclear
  - shared domain objects crossing package boundaries
- Use `import type` for type-only imports when practical.
- Treat `any` as a last resort. If it is temporarily unavoidable, keep the cast local and document why if the reason is not obvious.
- Handle async work deliberately:
  - `await` promises you start unless they are intentionally detached
  - wrap fire-and-forget work with explicit error handling or logging
  - do not ignore promise-returning calls in command handlers, controllers, cron jobs, or startup code
- Prefer one import per module path and avoid duplicate imports from the same file.
- Keep modules cohesive. If a file starts mixing HTTP, persistence, and domain logic, split responsibilities before adding more behavior.

## Architecture Notes

- `frontend/` should focus on presentation, polling, and user interaction. Data shaping should stay close to the API contract, not drift into duplicated scoring logic.
- `backend/` owns tournament rules, cron scheduling, Riot API access, scoring, and persistence concerns.
- `tipti-clanker/` should stay thin: command flow, Discord UX, and backend integration. Shared business rules belong in the backend unless the bot truly needs a local-only helper.
- When a backend response shape changes, update the consuming frontend and bot code in the same change.

## Commands

Run commands from the package directory unless noted otherwise.

### Repo Root

```bash
npm run lint:all
```

### Frontend

```bash
npm run dev
npm run build
npm run lint
```

### Backend

```bash
npm run dev
npm run build
npm run test
npm run lint
```

### Discord Bot

```bash
npm run dev
npm run watch
npm run build
npm run lint
```

## Testing Expectations

- Run the narrowest relevant test command first, then widen scope if the change touches shared behavior.
- Backend changes that affect cron flow, scoring, notifications, or persistence should include or update Vitest coverage where practical.
- Frontend changes should at minimum pass lint and build; add tests when the component logic becomes stateful or domain-heavy.
- Bot changes should at minimum pass lint and build; add tests when helper logic or data transformations stop being trivial.

## Linting Baseline

Linting is intentionally pragmatic in this repo:

- catch unused code and obvious TypeScript mistakes
- catch floating promises and async misuse
- encourage consistent type imports
- avoid enforcing low-value formatting or stylistic churn

If a rule blocks a valid pattern, prefer a small local suppression with a brief reason over weakening the entire config.
