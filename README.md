# Kumbara

A piggy-bank themed tracker for money coming in and going out, with transaction receipts, an Admin view of everything, and exchange-rate history so you can see what an amount was worth on any day.

Built with Next.js (App Router, TypeScript), Tailwind CSS, PostgreSQL and Prisma.

## Requirements

- Node.js 22 or newer
- PostgreSQL 16 (local install, or `docker compose up -d db`)

## Getting started

```bash
cp .env.example .env          # then fill in AUTH_SECRET (openssl rand -base64 32)
docker compose up -d db       # or point DATABASE_URL at your own Postgres
npm install                   # also generates the Prisma client
npm run db:migrate            # apply migrations
npm run dev                   # http://localhost:3000
```

`GET /api/health` reports whether the app can reach the database.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, including generated route types |
| `npm test` | Unit tests (Vitest) |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply migrations in production or CI |
| `npm run db:studio` | Browse the database |

## Environment variables

See [`.env.example`](.env.example). `DATABASE_URL` and `AUTH_SECRET` are required; the app validates all variables at startup and lists every problem at once.
