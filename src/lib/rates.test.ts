import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { RateBook, addDays, frankfurter, worth } from "@/lib/rates";

const D = (n: number | string) => new Prisma.Decimal(n);

// 1 USD = ... ; 2026-10-16 is a Friday, 2026-10-19 the next Monday.
const book = new RateBook("USD", [
  { quote: "TRY", date: "2026-10-15", rate: D("41.50") },
  { quote: "TRY", date: "2026-10-16", rate: D("41.60") },
  { quote: "TRY", date: "2026-10-19", rate: D("42.00") },
  { quote: "EUR", date: "2026-10-15", rate: D("0.85") },
  { quote: "EUR", date: "2026-10-16", rate: D("0.86") },
  { quote: "EUR", date: "2026-10-19", rate: D("0.84") },
]);

describe("RateBook", () => {
  it("converts from the base currency on a business day", () => {
    const c = book.convert(20, "USD", "TRY", "2026-10-16")!;
    expect(c.value.toString()).toBe("832");
    expect(c.rateDate).toBe("2026-10-16");
  });

  it("uses Friday's rate over the weekend", () => {
    for (const day of ["2026-10-17", "2026-10-18"]) {
      const c = book.convert(20, "USD", "TRY", day)!;
      expect(c.value.toString()).toBe("832");
      expect(c.rateDate).toBe("2026-10-16");
    }
  });

  it("works out cross rates through the base", () => {
    // 1 EUR = 41.60 / 0.86 TRY on Friday
    const c = book.convert(10, "EUR", "TRY", "2026-10-16")!;
    expect(c.value.toFixed(4)).toBe("483.7209");
    expect(book.convert(10, "TRY", "USD", "2026-10-19")!.value.toFixed(4)).toBe("0.2381");
  });

  it("returns the same amount for the same currency", () => {
    expect(book.convert(5, "EUR", "EUR", "2026-10-16")!.value.toString()).toBe("5");
  });

  it("has no answer before the first rate, after a long gap, or for an unknown currency", () => {
    expect(book.convert(1, "USD", "TRY", "2026-10-14")).toBeNull();
    expect(book.convert(1, "USD", "TRY", addDays("2026-10-19", 8))).toBeNull();
    expect(book.convert(1, "USD", "TRY", addDays("2026-10-19", 7))).not.toBeNull();
    expect(book.convert(1, "USD", "GBP", "2026-10-16")).toBeNull();
  });

  it("builds a rate history for a pair", () => {
    const h = book.history("EUR", "TRY", "2026-10-01", "2026-10-31");
    expect(h.map((p) => p.date)).toEqual(["2026-10-15", "2026-10-16", "2026-10-19"]);
    expect(h[2].rate.toFixed(2)).toBe("50.00");
  });
});

describe("worth", () => {
  it("shows what $20 was worth in TRY then and now", () => {
    const w = worth(book, 20, "USD", "2026-10-16", "2026-10-19", "TRY")!;
    expect(w.currency).toBe("TRY");
    expect(w.then.value.toString()).toBe("832");
    expect(w.now.value.toString()).toBe("840");
    expect(w.change).toBeCloseTo(0.009615, 5);
  });

  it("measures home-currency amounts in the base currency instead", () => {
    const w = worth(book, 420, "TRY", "2026-10-19", "2026-10-19", "TRY")!;
    expect(w.currency).toBe("USD");
    expect(w.now.value.toString()).toBe("10");
    expect(w.change).toBe(0);
  });

  it("is empty when a rate is missing", () => {
    expect(worth(book, 1, "GBP", "2026-10-16", "2026-10-19", "TRY")).toBeNull();
  });
});

describe("frankfurter", () => {
  const fakeFetch = (status: number, body: unknown, seen: string[] = []) =>
    (async (url: string) => {
      seen.push(url);
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;

  it("reads a date range", async () => {
    const seen: string[] = [];
    const body = {
      amount: 1,
      base: "USD",
      start_date: "2026-10-15",
      end_date: "2026-10-16",
      rates: { "2026-10-15": { TRY: 41.5, EUR: 0.85 }, "2026-10-16": { TRY: 41.6 } },
    };
    const rows = await frankfurter("https://rates.example/", fakeFetch(200, body, seen)).fetchRates(
      "USD",
      "2026-10-15",
      "2026-10-16",
    );
    expect(seen).toEqual(["https://rates.example/2026-10-15..2026-10-16?base=USD"]);
    expect(rows.map((r) => `${r.date} ${r.quote} ${r.rate}`)).toEqual([
      "2026-10-15 TRY 41.5",
      "2026-10-15 EUR 0.85",
      "2026-10-16 TRY 41.6",
    ]);
  });

  it("reads a single day, which may come back as the last business day", async () => {
    const body = { amount: 1, base: "USD", date: "2026-10-16", rates: { TRY: 41.6 } };
    const rows = await frankfurter("https://rates.example", fakeFetch(200, body)).fetchRates(
      "USD",
      "2026-10-18",
      "2026-10-18",
    );
    expect(rows).toEqual([{ quote: "TRY", date: "2026-10-16", rate: D("41.6") }]);
  });

  it("treats 'nothing published yet' as no rows and other failures as errors", async () => {
    const p = (status: number, body: unknown) => frankfurter("https://x", fakeFetch(status, body));
    expect(await p(404, { message: "not found" }).fetchRates("USD", "2030-01-01", "2030-01-01")).toEqual([]);
    await expect(p(500, {}).fetchRates("USD", "2026-10-16", "2026-10-16")).rejects.toThrow("500");
    await expect(
      p(200, { base: "EUR", date: "2026-10-16", rates: {} }).fetchRates("USD", "2026-10-16", "2026-10-16"),
    ).rejects.toThrow("EUR");
    await expect(
      p(200, { base: "USD", date: "2026-10-16", rates: { TRY: -1 } }).fetchRates("USD", "2026-10-16", "2026-10-16"),
    ).rejects.toThrow();
  });
});
