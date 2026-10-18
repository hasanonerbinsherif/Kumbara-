import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { createAccount, listAccounts } from "@/lib/accounts";
import {
  AccessError,
  createTransaction,
  getTransaction,
  listTransactions,
  type TransactionInput,
} from "@/lib/transactions";

// Runs against a real, migrated Postgres. Skipped when DATABASE_URL is not set.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("transactions", () => {
  let db: PrismaClient;
  const tag = `tx-${Date.now()}`;
  let alice: { id: string; role: "USER" };
  let bob: { id: string; role: "USER" };
  const admin = { id: "", role: "ADMIN" as const };
  let piggy: { id: string };
  let wallet: { id: string };
  let bobsPiggy: { id: string };

  // Form-style input; createTransaction validates it like the real form.
  const tx = (over: Record<string, string> = {}) =>
    ({
      direction: "INCOMING",
      amount: "20",
      currency: "USD",
      senderName: "Grandma",
      method: "CASH",
      occurredAt: "2026-10-10",
      ...over,
    }) as TransactionInput;

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    const mk = (n: string, role: "USER" | "ADMIN" = "USER") =>
      db.user.create({ data: { email: `${tag}-${n}@example.com`, name: n, passwordHash: "x", role } });
    alice = { id: (await mk("alice")).id, role: "USER" };
    bob = { id: (await mk("bob")).id, role: "USER" };
    admin.id = (await mk("admin", "ADMIN")).id;
    piggy = await createAccount(db, alice, { name: "Piggy", type: "PIGGY_BANK", currency: "usd" });
    wallet = await createAccount(db, alice, { name: "Wallet", type: "CASH", currency: "TRY" });
    bobsPiggy = await createAccount(db, bob, { name: "Bob's piggy", type: "PIGGY_BANK", currency: "USD" });
  });

  afterAll(async () => {
    const ids = [alice.id, bob.id, admin.id];
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.transaction.deleteMany({ where: { createdById: { in: ids } } });
    await db.account.deleteMany({ where: { ownerId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  it("lists only your own accounts, and all of them for an admin", async () => {
    expect((await listAccounts(db, alice)).map((a) => a.name)).toEqual(["Piggy", "Wallet"]);
    const all = (await listAccounts(db, admin)).map((a) => a.id);
    expect(all).toEqual(expect.arrayContaining([piggy.id, wallet.id, bobsPiggy.id]));
  });

  it("logs who sent how much, to where and how, and writes the audit log", async () => {
    const created = await createTransaction(db, alice, tx({ toAccountId: piggy.id }));
    const found = await getTransaction(db, alice, created.id);
    expect(found).toMatchObject({ senderName: "Grandma", method: "CASH", currency: "USD" });
    expect(found?.amount.toString()).toBe("20");
    expect(found?.toAccount?.name).toBe("Piggy");
    expect(await db.auditLog.count({ where: { entity: "Transaction", entityId: created.id, action: "CREATE" } })).toBe(
      1,
    );
  });

  it("refuses to log money into someone else's account", async () => {
    await expect(createTransaction(db, alice, tx({ toAccountId: bobsPiggy.id }))).rejects.toBeInstanceOf(AccessError);
  });

  it("lets an admin log into anyone's account", async () => {
    await expect(
      createTransaction(db, admin, tx({ toAccountId: bobsPiggy.id, senderName: "Admin" })),
    ).resolves.toBeTruthy();
  });

  it("hides other people's transactions from regular users", async () => {
    const bobs = await createTransaction(db, bob, tx({ toAccountId: bobsPiggy.id, senderName: "Bob's mum" }));
    expect(await getTransaction(db, alice, bobs.id)).toBeNull();
    expect(await getTransaction(db, admin, bobs.id)).not.toBeNull();
    const { rows } = await listTransactions(db, alice, {});
    expect(rows.every((r) => r.createdById === alice.id)).toBe(true);
  });

  it("totals money in and out per currency, and filters", async () => {
    await createTransaction(
      db,
      alice,
      tx({ direction: "OUTGOING", fromAccountId: piggy.id, amount: "5.50", method: "CARD", occurredAt: "2026-10-12" }),
    );
    await createTransaction(
      db,
      alice,
      tx({ toAccountId: wallet.id, amount: "100", currency: "TRY", occurredAt: "2026-10-14" }),
    );
    await createTransaction(
      db,
      alice,
      tx({ direction: "TRANSFER", fromAccountId: piggy.id, toAccountId: wallet.id, amount: "1" }),
    );

    const { totals } = await listTransactions(db, alice, {});
    expect(totals).toEqual([
      { currency: "TRY", incoming: "100.00", outgoing: "0.00", net: "100.00" },
      { currency: "USD", incoming: "20.00", outgoing: "5.50", net: "14.50" },
    ]);

    const card = await listTransactions(db, alice, { method: "CARD" });
    expect(card.rows.map((r) => r.amount.toString())).toEqual(["5.5"]);

    const window = await listTransactions(db, alice, { from: new Date("2026-10-12"), to: new Date("2026-10-12") });
    expect(window.rows).toHaveLength(1);

    const walletRows = await listTransactions(db, alice, { accountId: wallet.id });
    expect(walletRows.rows).toHaveLength(2);
  });

  it("leaves soft-deleted transactions out", async () => {
    const t = await createTransaction(db, alice, tx({ toAccountId: piggy.id, senderName: "Deleted" }));
    await db.transaction.update({ where: { id: t.id }, data: { deletedAt: new Date() } });
    expect(await getTransaction(db, alice, t.id)).toBeNull();
    const { rows } = await listTransactions(db, alice, {});
    expect(rows.find((r) => r.id === t.id)).toBeUndefined();
  });
});
