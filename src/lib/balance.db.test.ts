import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { createAccount } from "@/lib/accounts";
import { piggyBalance } from "@/lib/balance";
import { currencySymbol } from "@/lib/money";
import { createTransaction, type TransactionInput } from "@/lib/transactions";

// Runs against a real, migrated Postgres. Skipped when DATABASE_URL is not set.
const url = process.env.DATABASE_URL;

// A made-up base and home currency so these rows never mix with real ones.
const BASE = "XTS";
const HOME = "XXX";

describe("currencySymbol", () => {
  it("uses the short symbol where there is one", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("TRY")).toBe("₺");
    expect(currencySymbol("XTS")).toBe("XTS");
  });
});

describe.skipIf(!url)("piggyBalance", () => {
  let db: PrismaClient;
  const tag = `pig-${Date.now()}`;
  let ayla: { id: string; role: "USER" };
  let bob: { id: string; role: "USER" };

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    const mk = (n: string) =>
      db.user.create({ data: { email: `${tag}-${n}@example.com`, name: n, passwordHash: "x" } });
    ayla = { id: (await mk("ayla")).id, role: "USER" };
    bob = { id: (await mk("bob")).id, role: "USER" };
    await db.exchangeRate.createMany({
      data: [
        {
          base: BASE,
          quote: HOME,
          rate: new Prisma.Decimal(2),
          date: new Date("2026-10-16T00:00:00Z"),
          source: "ECB/Frankfurter",
        },
        {
          base: BASE,
          quote: "EUR",
          rate: new Prisma.Decimal(1),
          date: new Date("2026-10-16T00:00:00Z"),
          source: "ECB/Frankfurter",
        },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    const ids = [ayla.id, bob.id];
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.transaction.deleteMany({ where: { createdById: { in: ids } } });
    await db.account.deleteMany({ where: { ownerId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.exchangeRate.deleteMany({ where: { base: BASE } });
    await db.$disconnect();
  });

  const opts = { base: BASE, home: HOME, today: "2026-10-17" };

  it("is empty before anything comes in", async () => {
    const p = await piggyBalance(db, ayla, opts);
    expect(p.balance.toString()).toBe("0");
    expect(p.kept).toBe(0);
  });

  it("adds money in, subtracts money out, ignores transfers and other people's money", async () => {
    const piggy = await createAccount(db, ayla, { name: "Piggy", type: "PIGGY_BANK", currency: "EUR" });
    const wallet = await createAccount(db, ayla, { name: "Wallet", type: "CASH", currency: "EUR" });
    const bobs = await createAccount(db, bob, { name: "Bob's", type: "PIGGY_BANK", currency: "EUR" });
    const tx = (viewer: typeof ayla, x: Record<string, string>) =>
      createTransaction(db, viewer, {
        currency: "EUR",
        senderName: "Grandma",
        method: "CASH",
        occurredAt: "2026-10-10",
        ...x,
      } as TransactionInput);
    await tx(ayla, { direction: "INCOMING", amount: "100", toAccountId: piggy.id });
    await tx(ayla, { direction: "OUTGOING", amount: "25", fromAccountId: piggy.id, recipientName: "Shop" });
    await tx(ayla, { direction: "TRANSFER", amount: "30", fromAccountId: piggy.id, toAccountId: wallet.id });
    await tx(bob, { direction: "INCOMING", amount: "999", toAccountId: bobs.id });
    await tx(ayla, { direction: "INCOMING", amount: "5", currency: "ARS", toAccountId: wallet.id });

    const p = await piggyBalance(db, ayla, opts);
    // 100 − 25 EUR = 75 EUR = 150 XXX (1 XTS = 1 EUR = 2 XXX); ARS has no rate.
    expect(p.balance.toString()).toBe("150");
    expect(p.received.toString()).toBe("200");
    expect(p.kept).toBe(0.75);
    expect(p.missing).toEqual(["ARS"]);
  });
});
