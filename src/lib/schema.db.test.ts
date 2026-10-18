import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { ensureAdmin } from "@/lib/admin";
import { verifyPassword } from "@/lib/password";

// Runs against a real, migrated Postgres. Skipped when DATABASE_URL is not set.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("database schema", () => {
  let db: PrismaClient;
  const tag = `test-${Date.now()}`;
  const email = `${tag}@example.com`;

  beforeAll(() => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  });

  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: { startsWith: tag } } });
    const ids = users.map((u) => u.id);
    await db.receipt.deleteMany({ where: { uploadedById: { in: ids } } });
    await db.transaction.deleteMany({ where: { createdById: { in: ids } } });
    await db.account.deleteMany({ where: { ownerId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.exchangeRate.deleteMany({ where: { source: tag } });
    await db.$disconnect();
  });

  it("creates the first Admin once and never resets its password", async () => {
    const first = await ensureAdmin(db, { email, password: "first-password-123" });
    expect(first.created).toBe(true);

    const again = await ensureAdmin(db, { email: email.toUpperCase(), password: "other-password-456" });
    expect(again).toEqual({ id: first.id, created: false });

    const admin = await db.user.findUniqueOrThrow({ where: { id: first.id } });
    expect(admin.role).toBe("ADMIN");
    expect(await verifyPassword("first-password-123", admin.passwordHash)).toBe(true);
  });

  it("promotes an existing user to Admin", async () => {
    const user = await db.user.create({
      data: { email: `${tag}-user@example.com`, name: "User", passwordHash: "x" },
    });
    await ensureAdmin(db, { email: user.email, password: "any-password-123" });
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.role).toBe("ADMIN");
    expect(updated.passwordHash).toBe("x");
  });

  it("rejects a short Admin password", async () => {
    await expect(ensureAdmin(db, { email: `${tag}-short@example.com`, password: "short" })).rejects.toThrow(
      /ADMIN_PASSWORD/,
    );
  });

  it("records who sent how much, from where, to where and how, with a receipt", async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { email } });
    const piggy = await db.account.create({
      data: { ownerId: owner.id, name: "Piggy", type: "PIGGY_BANK", currency: "USD" },
    });

    const tx = await db.transaction.create({
      data: {
        direction: "INCOMING",
        amount: "20.00",
        currency: "USD",
        senderName: "Ayşe",
        toAccountId: piggy.id,
        method: "CASH",
        occurredAt: new Date("2026-10-17T12:00:00Z"),
        createdById: owner.id,
        receipts: {
          create: {
            storageKey: `${tag}/receipt.jpg`,
            fileName: "receipt.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 1024,
            sha256: "a".repeat(64),
            uploadedById: owner.id,
          },
        },
      },
      include: { receipts: true, toAccount: true },
    });

    expect(tx.amount.toString()).toBe("20");
    expect(tx.toAccount?.name).toBe("Piggy");
    expect(tx.receipts).toHaveLength(1);
  });

  it("refuses a zero or negative amount", async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { email } });
    await expect(
      db.transaction.create({
        data: {
          direction: "OUTGOING",
          amount: "-5",
          currency: "USD",
          senderName: "Me",
          method: "CARD",
          occurredAt: new Date(),
          createdById: owner.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("refuses a lowercase currency code", async () => {
    const owner = await db.user.findUniqueOrThrow({ where: { email } });
    await expect(
      db.account.create({ data: { ownerId: owner.id, name: "Bad", type: "CASH", currency: "usd" } }),
    ).rejects.toThrow();
  });

  it("stores one rate per pair per day per source", async () => {
    const row = { base: "USD", quote: "TRY", rate: "41.2345", date: new Date("2026-10-17"), source: tag };
    await db.exchangeRate.create({ data: row });
    await expect(db.exchangeRate.create({ data: row })).rejects.toThrow();
  });
});
