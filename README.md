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
npm run db:seed               # create the first Admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                   # http://localhost:3000
```

`GET /api/health` reports whether the app can reach the database.

## Logging in and roles

Log in at `/login` with the Admin from `npm run db:seed`. Sessions are a signed, HTTP-only cookie (HS256 with `AUTH_SECRET`) that lasts 7 days.

- Logged-out visitors are sent to `/login`, then back to the page they asked for.
- Only Admins can open `/admin`; other users are sent to `/dashboard`.
- Every page re-checks the user against the database, so a deleted or demoted user loses access at once.
- Queries for user data go through `scopeFor()` in `src/lib/access.ts`: regular users see only their own accounts, transactions and receipts, Admins see everything.
- Logins and logouts are written to the audit log.

## Logging money

- **Accounts** (`/accounts`): piggy banks, cash wallets, bank accounts and cards, each in one currency.
- **New transaction** (`/transactions/new`): money in, money out, or a transfer between two of your accounts. It records who sent it, how much, in which currency, from where, to where, how and when.
- **Transactions** (`/transactions`): newest first, filterable by date range, type, method, account and currency, with totals in and out per currency. Transfers don't change the totals.
- **Detail** (`/transactions/<id>`): who sent how much, to where, and how, in one sentence, plus who logged it.

Regular users only see and use their own accounts. Admins see everyone's and get a "Logged by" column.

## Receipts

On a transaction's page you can attach photos (JPEG, PNG, WebP, HEIC) or PDFs, up to 10 MB each, several at once.

- The file type is checked from the file's contents, not its name, so a renamed file can't pose as a receipt.
- The same file can't be attached twice to one transaction (matched by SHA-256).
- Files are served from `/receipts/<id>` only to the transaction's owner and Admins; anyone else gets a 404.
- Uploads and removals are written to the audit log.
- Files are stored on local disk under `RECEIPTS_DIR` (default `storage/receipts`, git-ignored). Back this folder up together with the database. Storage sits behind the `FileStorage` interface in `src/lib/storage.ts`, so S3 or Cloudflare R2 can replace it later without changing anything else.

## Exchange rates

Rates are fetched once a day from the European Central Bank (via [Frankfurter](https://frankfurter.dev), no key needed) and stored against `BASE_CURRENCY` (USD). Every "then vs today" question is then answered from the database.

- **First run:** `npm run rates:backfill -- 2025-01-01` fetches every day from that date to today. Safe to re-run; days already stored are skipped.
- **Every day:** call `GET /api/cron/rates` with `Authorization: Bearer $CRON_SECRET` (for example from a hosting provider's cron), or run `npm run rates:sync`. Either one fills in everything since the last stored day.
- **Weekends and holidays:** the ECB publishes on business days only, so a lookup uses the latest rate on or before the day asked, up to 7 days back.
- **Any pair:** EUR to TRY is worked out through USD, so no extra rates are needed.
- **Where it shows:** the dashboard's "Then vs today" card (an amount on a past day vs today, plus a 90-day chart), a "Worth today" column on the transactions list (in `HOME_CURRENCY`, or `BASE_CURRENCY` for amounts already in the home currency), and "Worth then / today" on each transaction.
- The ECB covers about 30 major currencies. Others (for example ARS) show "—" where no rate exists.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, including generated route types |
| `npm test` | Unit tests, plus database tests when `DATABASE_URL` points at a migrated Postgres |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply migrations in production or CI |
| `npm run db:seed` | Create the first Admin (safe to re-run; never resets a password) |
| `npm run db:studio` | Browse the database |
| `npm run rates:sync` | Fetch exchange rates since the last stored day |
| `npm run rates:backfill -- <from> [<to>]` | Fetch exchange rates for a date range |

## Environment variables

See [`.env.example`](.env.example). `DATABASE_URL` and `AUTH_SECRET` are required; the app validates all variables at startup and lists every problem at once.

## Data model

| Table | Holds |
| --- | --- |
| `User` | People who log in, with role `ADMIN` or `USER` |
| `Account` | A piggy bank, wallet, bank account or card, in one currency |
| `Transaction` | Who sent how much, in which currency, from where, to where, how and when |
| `Receipt` | Uploaded photos or PDFs proving a transaction |
| `ExchangeRate` | One rate per currency pair per day |
| `AuditLog` | Who changed what and when |

The database also refuses zero or negative amounts and rates, and currency codes that aren't three capital letters.
