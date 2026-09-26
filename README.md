# POSflow Commerce

Multi-tenant eCommerce SaaS for Pakistan/MENA D2C brands: one API powering each merchant's storefront,
a merchant admin, and a platform (super) admin.

| App | Path | Port | What it is |
| :--- | :--- | :--- | :--- |
| API | `apps/api` | 4000 | NestJS + Fastify, Drizzle ORM, PostgreSQL |
| Storefront | `apps/web` | 3000 | Next.js — catalog, cart, COD checkout |
| Merchant admin | `apps/merchant-admin` | 3001 | Orders, products, stock, customers, discounts, analytics, settings |
| Platform admin | `apps/platform-admin` | 3002 | Tenants, merchant logins, platform metrics |
| DB package | `packages/db` | — | Drizzle schema, SQL migrations, CLI scripts |

Architecture, invariants and design decisions: [SYSTEM_ARCHITECTURE_CONTEXT.md](SYSTEM_ARCHITECTURE_CONTEXT.md).

## First-time setup

Requires Node 24+ and pnpm 9.

```bash
pnpm install
```

Create `apps/api/.env` and `packages/db/.env` from [apps/api/.env.example](apps/api/.env.example) (at minimum `DATABASE_URL`), then:

```bash
pnpm db:migrate                                                          # create/upgrade the schema
pnpm db:seed                                                             # demo store (development only)
pnpm db:create-user --role platform_admin --email you@example.com        # prompts for a password
pnpm db:create-user --role merchant --email owner@brand.pk --tenant ten_pilot_01
pnpm dev                                                                 # all apps
```

## Database commands

| Command | Does |
| :--- | :--- |
| `pnpm db:migrate` | Apply pending files in `packages/db/migrations` (each in a transaction). `db:push` is an alias. |
| `pnpm db:status` | List applied / pending migrations. |
| `pnpm db:check` | Fail if the database and the Drizzle schema disagree, or a migration is pending. Run before deploying. |
| `pnpm db:seed` | Load the demo tenant/store. Refuses to run with `NODE_ENV=production`. |
| `pnpm db:create-user` / `db:reset-password` | Manage logins (hidden password prompt). |
| `pnpm db:reset --confirm` | **Drops every table.** Development only. |

**Changing the schema:** edit `packages/db/src/index.ts` (what the code expects) *and* add a new numbered SQL
file in `packages/db/migrations` (what the database gets). Never edit a migration that has been applied —
`db:migrate` refuses if a checksum changed. `db:check` catches the two drifting apart.

## Tests

```bash
pnpm --filter api test                                  # unit tests, no database (seconds)
E2E_ALLOW_WRITES=true pnpm --filter api test:e2e        # end-to-end, needs a database (minutes)
```

The end-to-end suite builds the API, runs it on a spare port and checks auth, tenant isolation,
race-safe checkout (stock, order numbers, coupon limits, customers), order tokens and admin features.
It **writes to `DATABASE_URL`** — point it at a Neon branch or test database — and removes everything it creates.

## Production notes

- Set `NODE_ENV=production` (secure cookies, no demo seed, rate limits always on).
- Admin apps call the API through their own `/api/*` rewrite (`API_URL`), so session cookies stay first-party.
- Set `TRUST_PROXY` to the number of proxies in front of the API so rate limits see real client IPs.
- Health checks: `GET /health` (process up) and `GET /health/ready` (database reachable, 503 if not).
- Logs are JSON on stdout; every response carries an `x-request-id` that also appears in error logs.
- Rate limits and login lockouts are in-memory: fine for one API instance, move to Redis before running several.
