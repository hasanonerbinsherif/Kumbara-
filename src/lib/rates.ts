import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";

/**
 * Exchange rates are stored once a day against one base currency (USD by
 * default): a row says "1 base = rate quote" on that date. Any pair, and any
 * past day, is then a database lookup rather than a live API call.
 */

export const RATE_SOURCE = "ECB/Frankfurter";

/** ECB rates skip weekends and holidays; an older rate than this is treated as missing. */
export const MAX_RATE_AGE_DAYS = 7;

/** Frankfurter samples long ranges, so backfills are fetched in chunks of this many days. */
const CHUNK_DAYS = 90;

export type RateRow = { quote: string; date: string; rate: Prisma.Decimal };

export interface RatesProvider {
  source: string;
  fetchRates(base: string, start: string, end: string): Promise<RateRow[]>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A UTC calendar date as YYYY-MM-DD. */
export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  return isoDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

const rateMap = z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive());
const frankfurterResponse = z.union([
  z.object({ base: z.string(), date: z.iso.date(), rates: rateMap }),
  z.object({ base: z.string(), rates: z.record(z.iso.date(), rateMap) }),
]);

/** European Central Bank reference rates via Frankfurter (no API key needed). */
export function frankfurter(baseUrl: string, fetchImpl: typeof fetch = fetch): RatesProvider {
  return {
    source: RATE_SOURCE,
    async fetchRates(base, start, end) {
      const range = start === end ? start : `${start}..${end}`;
      const url = `${baseUrl.replace(/\/$/, "")}/${range}?base=${base}`;
      const response = await fetchImpl(url, {
        headers: { accept: "application/json" },
      });
      if (response.status === 404) return []; // no rates published in that range yet
      if (!response.ok) throw new Error(`Rates request failed: ${response.status} ${url}`);

      const body = frankfurterResponse.parse(await response.json());
      if (body.base !== base) throw new Error(`Rates came back in ${body.base}, expected ${base}`);
      const byDate = "date" in body ? { [body.date]: body.rates } : body.rates;
      return Object.entries(byDate).flatMap(([date, rates]) =>
        Object.entries(rates)
          .filter(([quote]) => quote !== base)
          .map(([quote, rate]) => ({
            quote,
            date,
            rate: new Prisma.Decimal(rate),
          })),
      );
    },
  };
}

/** Fetches and stores rates for every day from `from` to `to`; returns how many new rows were saved. */
export async function syncRates(
  db: PrismaClient,
  provider: RatesProvider,
  base: string,
  { from, to }: { from: string; to: string },
) {
  let saved = 0;
  for (let start = from; start <= to; start = addDays(start, CHUNK_DAYS)) {
    const end = [addDays(start, CHUNK_DAYS - 1), to].sort()[0];
    const rows = await provider.fetchRates(base, start, end);
    const { count } = await db.exchangeRate.createMany({
      data: rows.map((r) => ({
        base,
        quote: r.quote,
        rate: r.rate,
        date: new Date(`${r.date}T00:00:00Z`),
        source: provider.source,
      })),
      skipDuplicates: true,
    });
    saved += count;
  }
  return saved;
}

/** The daily job: fills in everything since the last stored day (or the past week on a fresh database). */
export async function syncLatestRates(
  db: PrismaClient,
  provider: RatesProvider,
  base: string,
  today = isoDate(new Date()),
) {
  const latest = await db.exchangeRate.findFirst({
    where: { base, source: provider.source },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const from = latest ? isoDate(latest.date) : addDays(today, -MAX_RATE_AGE_DAYS);
  return {
    from,
    to: today,
    saved: await syncRates(db, provider, base, { from, to: today }),
  };
}

export type Conversion = {
  value: Prisma.Decimal;
  rate: Prisma.Decimal;
  rateDate: string;
};

/** Rates against one base, answering "what was the rate on or before this day". */
export class RateBook {
  private readonly byQuote = new Map<string, { date: string; rate: Prisma.Decimal }[]>();

  constructor(
    readonly base: string,
    rows: RateRow[],
  ) {
    for (const row of rows) {
      const list = this.byQuote.get(row.quote) ?? [];
      list.push({ date: row.date, rate: new Prisma.Decimal(row.rate) });
      this.byQuote.set(row.quote, list);
    }
    for (const list of this.byQuote.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** 1 base = rate × currency, using the latest rate on or before `date`. */
  rateOn(currency: string, date: string): { rate: Prisma.Decimal; date: string } | null {
    if (currency === this.base) return { rate: new Prisma.Decimal(1), date };
    const list = this.byQuote.get(currency);
    if (!list) return null;
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].date <= date) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (found < 0 || daysBetween(list[found].date, date) > MAX_RATE_AGE_DAYS) return null;
    return list[found];
  }

  /** Converts through the base currency, so any pair works from one set of rates. */
  convert(amount: Prisma.Decimal | number | string, from: string, to: string, date: string): Conversion | null {
    const a = this.rateOn(from, date);
    const b = this.rateOn(to, date);
    if (!a || !b) return null;
    const rate = b.rate.div(a.rate);
    const rateDate = [a.date, b.date].sort()[0];
    return { value: new Prisma.Decimal(amount).mul(rate), rate, rateDate };
  }

  /** The from→to rate on every day either currency has a rate, oldest first. */
  history(from: string, to: string, start: string, end: string) {
    const dates = new Set<string>();
    for (const c of [from, to])
      for (const r of this.byQuote.get(c) ?? []) if (r.date >= start && r.date <= end) dates.add(r.date);
    return [...dates].sort().flatMap((date) => {
      const c = this.convert(1, from, to, date);
      return c ? [{ date, rate: c.rate }] : [];
    });
  }
}

/** Loads the rates needed to convert between `currencies` on days from `start` to `end`. */
export async function loadRateBook(db: PrismaClient, base: string, currencies: string[], start: string, end: string) {
  const rows = await db.exchangeRate.findMany({
    where: {
      base,
      source: RATE_SOURCE,
      quote: { in: [...new Set(currencies)].filter((c) => c !== base) },
      date: {
        gte: new Date(`${addDays(start, -MAX_RATE_AGE_DAYS)}T00:00:00Z`),
        lte: new Date(`${end}T00:00:00Z`),
      },
    },
    select: { quote: true, date: true, rate: true },
  });
  return new RateBook(
    base,
    rows.map((r) => ({ quote: r.quote, date: isoDate(r.date), rate: r.rate })),
  );
}

export type Worth = {
  currency: string;
  then: Conversion;
  now: Conversion;
  /** Change from then to now, as a fraction (0.05 = +5%). */
  change: number;
};

/**
 * What an amount was worth in `home` currency when it moved, and what it is
 * worth today. Amounts already in the home currency are measured in `base`
 * instead, so "500 TRY" still shows how its value moved.
 */
export function worth(
  book: RateBook,
  amount: Prisma.Decimal | number | string,
  currency: string,
  occurredAt: string,
  today: string,
  home: string,
): Worth | null {
  const target = currency === home ? book.base : home;
  if (target === currency) return null;
  const then = book.convert(amount, currency, target, occurredAt);
  const now = book.convert(amount, currency, target, today);
  if (!then || !now) return null;
  return {
    currency: target,
    then,
    now,
    change: now.value.div(then.value).minus(1).toNumber(),
  };
}

/** "Worth then vs today" for a list of transactions, in one query. Entries are null where a rate is missing. */
export async function worthOf(
  db: PrismaClient,
  { base, home, today = isoDate(new Date()) }: { base: string; home: string; today?: string },
  items: { amount: Prisma.Decimal; currency: string; occurredAt: Date }[],
) {
  if (items.length === 0) return [];
  const earliest = items.map((i) => isoDate(i.occurredAt)).sort()[0];
  const book = await loadRateBook(db, base, [home, ...items.map((i) => i.currency)], earliest, today);
  return items.map((i) => worth(book, i.amount, i.currency, isoDate(i.occurredAt), today, home));
}

/** The newest stored rate day, or null when no rates have been fetched yet. */
export async function latestRateDate(db: PrismaClient, base: string) {
  const latest = await db.exchangeRate.findFirst({
    where: { base, source: RATE_SOURCE },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return latest ? isoDate(latest.date) : null;
}
