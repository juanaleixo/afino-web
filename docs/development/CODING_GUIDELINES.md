# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router routes and layouts (e.g., `app/dashboard/page.tsx`).
- `components/`: Reusable UI (PascalCase, e.g., `components/PlanStatus.tsx`, `components/ui/`).
- `lib/`: Shared utilities and clients (e.g., `lib/supabase.ts`, `lib/portfolio.ts`).
- `hooks/`: React hooks (e.g., `hooks/useUserPlan.ts`).
- `styles/`: Global CSS and Tailwind (`styles/globals.css`, `tailwind.config.ts`).
- `public/`: Static assets.
- `docs/`: Architecture, routes, and deployment notes.
- `database/`: SQL and schema artifacts (e.g., `database/waitlist.sql`).
- `scripts/`: Deployment helpers (e.g., `scripts/deploy.sh`).

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server at `http://localhost:3000`.
- `npm run build`: Production build (Next.js). May generate `.next/` and `out/`.
- `npm start`: Serve the production build locally.
- `npm run lint`: Lint with ESLint (Next + TypeScript rules).
- `npm run deploy:preview` | `npm run deploy:production`: Deploy via Wrangler to Cloudflare Pages (requires `wrangler login`). Example: `./scripts/deploy.sh preview`.

## Coding Style & Naming Conventions
- TypeScript enabled with `strict: true`; prefer explicit types and narrow `any`.
- Indentation: 2 spaces; keep imports sorted logically.
- Components: PascalCase `.tsx`; hooks: camelCase starting with `use*`.
- App Router files follow Next.js conventions: `page.tsx`, `layout.tsx`.
- Use path aliases (`@/components/*`, `@/lib/*`, etc.) from `tsconfig.json`.
- Linting rules warn on `no-explicit-any` and `no-unused-vars`; run `npm run lint` before pushing.

## Testing Guidelines
- No test runner is configured yet. If adding tests, prefer Vitest + React Testing Library.
- Co-locate tests as `*.test.ts`/`*.test.tsx` next to sources (e.g., `components/Button.test.tsx`).
- Focus on unit tests for `lib/` and `components/`; keep tests deterministic.

## Commit & Pull Request Guidelines
- History shows no established convention; use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- PRs include: clear description, linked issues, screenshots/GIFs for UI changes, notes on config/env changes, and updates to docs when relevant.

## Security & Configuration Tips
- Secrets in `.env` (do not commit). Required keys commonly include `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Do not commit build artifacts (`.next/`, `out/`) unless explicitly requested.
- Review `docs/DEPLOY.md` and `wrangler.toml` before deploying.
