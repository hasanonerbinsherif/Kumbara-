import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { listAudit } from "@/lib/audit";
import { checkCredentials } from "@/lib/auth";
import { exportTransactions } from "@/lib/export";
import { createTransaction, listTransactions, type TransactionInput } from "@/lib/transactions";
import { createAccount } from "@/lib/accounts";
import { createUser, listUsers, resetPassword, setRole } from "@/lib/users";

// Runs against a real, migrated Postgres. Skipped when DATABASE_URL is not set.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("admin tools", () => {
  let db: PrismaClient;
  const tag = `adm-${Date.now()}`;
  const email = (n: string) => `${tag}-${n}@example.com`;
  const admin = { id: "", role: "ADMIN" as const };
  const created: string[] = [];

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    const a = await db.user.create({ data: { email: email("boss"), name: "Boss", passwordHash: "x", role: "ADMIN" } });
    admin.id = a.id;
    created.push(a.id);
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorId: { in: created } } });
    await db.transaction.deleteMany({ where: { createdById: { in: created } } });
    await db.account.deleteMany({ where: { ownerId: { in: created } } });
    await db.user.deleteMany({ where: { id: { in: created } } });
    await db.exchangeRate.deleteMany({ where: { source: "ECB/Frankfurter", base: "USD", quote: "XTS" } });
    await db.$disconnect();
  });

  it("lets an Admin add a user who can then log in", async () => {
    const u = await createUser(db, admin, {
      name: "Ayla",
      email: email("Ayla").toUpperCase(),
      password: "a-long-password-1",
    });
    created.push(u.id);
    expect(u).toMatchObject({ role: "USER", email: email("ayla") });
    expect(await checkCredentials(db, email("ayla"), "a-long-password-1")).not.toBeNull();
    const log = await db.auditLog.findFirst({ where: { entityId: u.id, action: "CREATE" } });
    expect(JSON.stringify(log?.after)).not.toContain("password");
  });

  it("refuses duplicates, short passwords and non-Admins", async () => {
    await expect(
      createUser(db, admin, { name: "Again", email: email("ayla"), password: "a-long-password-1" }),
    ).rejects.toThrow("already");
    await expect(createUser(db, admin, { name: "Short", email: email("short"), password: "short" })).rejects.toThrow();
    const user = { id: created[1], role: "USER" as const };
    await expect(createUser(db, user, { name: "X", email: email("x"), password: "a-long-password-1" })).rejects.toThrow(
      "Only an Admin",
    );
    await expect(setRole(db, user, admin.id, "USER")).rejects.toThrow("Only an Admin");
  });

  it("changes roles but never removes the last Admin or your own role", async () => {
    await expect(setRole(db, admin, admin.id, "USER")).rejects.toThrow("your own role");
    const ayla = created[1];
    await setRole(db, admin, ayla, "ADMIN");
    expect((await db.user.findUnique({ where: { id: ayla } }))?.role).toBe("ADMIN");
    await setRole(db, admin, ayla, "USER");
    const log = await db.auditLog.findFirst({ where: { entityId: ayla, action: "UPDATE" }, orderBy: { at: "desc" } });
    expect(log?.before).toEqual({ role: "ADMIN" });
    expect(log?.after).toEqual({ role: "USER" });
  });

  it("guards the last Admin", async () => {
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    // Only meaningful when this test's Boss is the sole Admin; otherwise the count check can't be exercised safely.
    if (admins.length === 1) {
      const other = await createUser(db, admin, {
        name: "Temp",
        email: email("temp"),
        password: "a-long-password-1",
        role: "ADMIN",
      });
      created.push(other.id);
      await setRole(db, { id: other.id, role: "ADMIN" }, admin.id, "USER");
      await expect(setRole(db, admin, other.id, "USER")).rejects.toThrow("at least one Admin");
    }
    expect(await db.user.count({ where: { role: "ADMIN" } })).toBeGreaterThanOrEqual(1);
  });

  it("resets a password without logging it", async () => {
    const ayla = created[1];
    await resetPassword(db, admin, ayla, "another-long-password");
    expect(await checkCredentials(db, email("ayla"), "a-long-password-1")).toBeNull();
    expect(await checkCredentials(db, email("ayla"), "another-long-password")).not.toBeNull();
    await expect(resetPassword(db, admin, ayla, "short")).rejects.toThrow("12");
    const { entries } = await listAudit(db, { actorId: admin.id, entity: "User", page: 1 });
    expect(entries.length).toBeGreaterThan(0);
    expect(JSON.stringify(entries.map((e) => e.after))).not.toContain("another-long-password");
  });

  it("lists users with their counts and last login", async () => {
    const ayla = created[1];
    await db.auditLog.create({ data: { actorId: ayla, action: "LOGIN", entity: "User", entityId: ayla } });
    const row = (await listUsers(db)).find((u) => u.id === ayla)!;
    expect(row.lastLoginAt).toBeInstanceOf(Date);
    expect(row._count).toEqual({ accounts: 0, transactions: 0 });
  });

  it("filters an Admin's transaction list by who logged them, but never widens a user's", async () => {
    const ayla = { id: created[1], role: "USER" as const };
    const piggy = await createAccount(db, ayla, { name: "Piggy", type: "PIGGY_BANK", currency: "USD" });
    const input = {
      direction: "INCOMING",
      amount: "20",
      currency: "USD",
      senderName: "=cmd|' /C calc'!A0",
      method: "CASH",
      occurredAt: "2026-10-16",
      toAccountId: piggy.id,
    };
    await createTransaction(db, ayla, input as TransactionInput);
    expect((await listTransactions(db, admin, { userId: ayla.id })).rows).toHaveLength(1);
    expect((await listTransactions(db, admin, { userId: admin.id })).rows).toHaveLength(0);
    expect((await listTransactions(db, ayla, { userId: admin.id })).rows).toHaveLength(0);
  });

  it("exports transactions with values in another currency", async () => {
    await db.exchangeRate.createMany({
      data: [
        {
          base: "USD",
          quote: "XTS",
          rate: new Prisma.Decimal("40"),
          date: new Date("2026-10-16T00:00:00Z"),
          source: "ECB/Frankfurter",
        },
      ],
      skipDuplicates: true,
    });
    const { csv } = await exportTransactions(
      db,
      "USD",
      { currency: "XTS", from: "2026-10-16", to: "2026-10-16" },
      "2026-10-19",
    );
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toContain("Value then (XTS)");
    const mine = lines.find((l) => l.includes(email("ayla")))!;
    expect(mine).toContain("2026-10-16,Money in,20.00,USD,800.00,2026-10-16,800.00,2026-10-16,");
    expect(mine).toContain(",'=cmd|' /C calc'!A0,"); // the sender's name can't run as a formula
  });
});
