import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { checkCredentials } from "@/lib/auth";
import { scopeFor } from "@/lib/access";
import { hashPassword } from "@/lib/password";

// Runs against a real, migrated Postgres. Skipped when DATABASE_URL is not set.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("login and data scoping", () => {
  let db: PrismaClient;
  const tag = `auth-${Date.now()}`;
  let alice: { id: string };
  let bob: { id: string };

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    const passwordHash = await hashPassword("alice-password-1");
    alice = await db.user.create({ data: { email: `${tag}-alice@example.com`, name: "Alice", passwordHash } });
    bob = await db.user.create({ data: { email: `${tag}-bob@example.com`, name: "Bob", passwordHash } });
    for (const owner of [alice, bob]) {
      await db.transaction.create({
        data: {
          direction: "INCOMING",
          amount: "20",
          currency: "USD",
          senderName: "Test",
          method: "CASH",
          occurredAt: new Date(),
          createdById: owner.id,
        },
      });
    }
  });

  afterAll(async () => {
    const ids = [alice.id, bob.id];
    await db.transaction.deleteMany({ where: { createdById: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  it("accepts the right password, ignoring email case and spaces", async () => {
    expect(await checkCredentials(db, ` ${tag}-ALICE@example.com `, "alice-password-1")).toEqual({
      id: alice.id,
      role: "USER",
    });
  });

  it("rejects a wrong password and an unknown email the same way", async () => {
    expect(await checkCredentials(db, `${tag}-alice@example.com`, "wrong")).toBeNull();
    expect(await checkCredentials(db, `${tag}-nobody@example.com`, "alice-password-1")).toBeNull();
  });

  it("shows a user only their own transactions", async () => {
    const mine = await db.transaction.findMany({
      where: { AND: [scopeFor({ id: alice.id, role: "USER" }).transactions, { createdById: { in: [alice.id, bob.id] } }] },
    });
    expect(mine.map((t) => t.createdById)).toEqual([alice.id]);
  });

  it("shows an admin everyone's transactions", async () => {
    const all = await db.transaction.findMany({
      where: { AND: [scopeFor({ id: "admin", role: "ADMIN" }).transactions, { createdById: { in: [alice.id, bob.id] } }] },
    });
    expect(new Set(all.map((t) => t.createdById))).toEqual(new Set([alice.id, bob.id]));
  });
});
