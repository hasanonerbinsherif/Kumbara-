import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { type RatesProvider, addDays, loadRateBook, syncLatestRates, syncRates } from "@/lib/rates";

// Runs against a real, migrated Postgres. Skipped when DATABASE_URL is not set.
const url = process.env.DATABASE_URL;

// A made-up base so these rows never mix with real ones; the provider is a fake, no network.
const BASE = "XTS";
const SOURCE = "ECB/Frankfurter";

function fakeProvider() {
  const calls: [string, string][] = [];
  const provider: RatesProvider = {
    source: SOURCE,
    async fetchRates(_base, start, end) {
      calls.push([start, end]);
      const rows = [];
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (weekday === 0 || weekday === 6) continue;
        rows.push({ quote: "TRY", date: d, rate: new Prisma.Decimal(40 + Number(d.slice(8)) / 100) });
      }
      return rows;
    },
  };
  return { provider, calls };
}

describe.skipIf(!url)("rates in the database", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    await db.exchangeRate.deleteMany({ where: { base: BASE } });
  });

  afterAll(async () => {
    await db.exchangeRate.deleteMany({ where: { base: BASE } });
    await db.$disconnect();
  });

  it("backfills in chunks and never stores a day twice", async () => {
    const { provider, calls } = fakeProvider();
    const saved = await syncRates(db, provider, BASE, { from: "2026-01-01", to: "2026-06-30" });
    expect(calls).toEqual([
      ["2026-01-01", "2026-03-31"],
      ["2026-04-01", "2026-06-29"],
      ["2026-06-30", "2026-06-30"],
    ]);
    expect(saved).toBe(129); // business days in the first half of 2026
    expect(await syncRates(db, provider, BASE, { from: "2026-06-01", to: "2026-06-30" })).toBe(0);
  });

  it("the daily job picks up from the last stored day", async () => {
    const { provider, calls } = fakeProvider();
    const result = await syncLatestRates(db, provider, BASE, "2026-07-03");
    expect(calls).toEqual([["2026-06-30", "2026-07-03"]]);
    expect(result.saved).toBe(3);
  });

  it("loads what a conversion needs and answers weekend questions", async () => {
    const book = await loadRateBook(db, BASE, ["TRY"], "2026-07-04", "2026-07-05");
    const c = book.convert(10, BASE, "TRY", "2026-07-05")!; // Sunday → Friday 3 July
    expect(c.rateDate).toBe("2026-07-03");
    expect(c.value.toString()).toBe("400.3");
  });
});
