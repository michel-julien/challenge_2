# CampusAPI — Frontend

Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui frontend for the
CampusAPI student services project. The backend contract is documented in
[`API_CONTRACT.md`](./API_CONTRACT.md).

## Run locally

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Other scripts: `pnpm lint`, `pnpm build`, `pnpm start`.
With Docker Compose (from the repo root) the frontend runs on
`http://localhost:5000`.

## Mock mode vs real API

All network calls go through `lib/api.ts`.

- **Mock mode (default):** if `NEXT_PUBLIC_API_URL` is not set, an in-memory
  mock (`lib/mock-api.ts`) is used, with a small artificial delay. Demo login:
  `demo@campus.edu` / `password123`. Mock state lives in memory, so reloading
  the page logs you out and forgets registered accounts.
- **Real API:** set `NEXT_PUBLIC_API_URL` to the backend URL. Requests use
  `fetch` with `credentials: "include"`; the session is an httpOnly cookie set
  by the backend (no tokens in localStorage).

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:5001
pnpm dev
```

`NEXT_PUBLIC_*` variables are inlined at build/dev-start time, so restart
`pnpm dev` (or rebuild) after changing it.

## Structure

- `app/` — routes (`/` home, `/profile`) and root layout
- `components/site-header.tsx` — sticky header with nav and login / account menu
- `components/auth/` — `AuthProvider` (calls `GET /api/users/me` on load),
  login/register dialog and forms, user menu
- `components/ui/` — shadcn/ui components
- `lib/api.ts`, `lib/api-types.ts`, `lib/mock-api.ts` — typed API client and mock
- `lib/validation.ts` — zod schemas (client validation is for UX only; the
  backend must validate too)
