import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { MAX_RECEIPT_BYTES, addReceipt, deleteReceipt, readReceipt } from "@/lib/receipts";
import { LocalDiskStorage } from "@/lib/storage";
import { createAccount } from "@/lib/accounts";
import { createTransaction, type TransactionInput } from "@/lib/transactions";

// Runs against a real, migrated Postgres. Skipped when DATABASE_URL is not set.
const url = process.env.DATABASE_URL;

const pdf = (text: string) => ({ name: "receipt.pdf", bytes: new TextEncoder().encode(`%PDF-1.4\n${text}`) });

describe.skipIf(!url)("receipts", () => {
  let db: PrismaClient;
  let root: string;
  let storage: LocalDiskStorage;
  const tag = `rc-${Date.now()}`;
  let alice: { id: string; role: "USER" };
  let bob: { id: string; role: "USER" };
  const admin = { id: "", role: "ADMIN" as const };
  let txId: string;

  const files = async () => (await readdir(path.join(root, txId)).catch(() => [])).length;

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    root = await mkdtemp(path.join(tmpdir(), "kumbara-receipts-"));
    storage = new LocalDiskStorage(root);
    const mk = (n: string, role: "USER" | "ADMIN" = "USER") =>
      db.user.create({ data: { email: `${tag}-${n}@example.com`, name: n, passwordHash: "x", role } });
    alice = { id: (await mk("alice")).id, role: "USER" };
    bob = { id: (await mk("bob")).id, role: "USER" };
    admin.id = (await mk("admin", "ADMIN")).id;
    const piggy = await createAccount(db, alice, { name: "Piggy", type: "PIGGY_BANK", currency: "USD" });
    const input = { toAccountId: piggy.id, direction: "INCOMING", amount: "20", currency: "USD", senderName: "Grandma", method: "CASH", occurredAt: "2026-10-10" };
    txId = (await createTransaction(db, alice, input as TransactionInput)).id;
  });

  afterAll(async () => {
    const ids = [alice.id, bob.id, admin.id];
    await db.receipt.deleteMany({ where: { uploadedById: { in: ids } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.transaction.deleteMany({ where: { createdById: { in: ids } } });
    await db.account.deleteMany({ where: { ownerId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  it("attaches a receipt, stores the file and records it in the audit log", async () => {
    const receipt = await addReceipt(db, storage, alice, txId, pdf("one"));
    expect(receipt).toMatchObject({ mimeType: "application/pdf", fileName: "receipt.pdf", uploadedById: alice.id });
    expect(receipt.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await files()).toBe(1);
    const log = await db.auditLog.findFirst({ where: { entity: "Receipt", entityId: receipt.id } });
    expect(log?.action).toBe("CREATE");

    const read = await readReceipt(db, storage, alice, receipt.id);
    expect(new TextDecoder().decode(read!.bytes)).toBe("%PDF-1.4\none");
  });

  it("rejects the same file twice on one transaction", async () => {
    await expect(addReceipt(db, storage, alice, txId, pdf("one"))).rejects.toThrow("already attached");
    expect(await files()).toBe(1);
  });

  it("rejects files that are not receipts, and oversized ones", async () => {
    const html = { name: "receipt.pdf", bytes: new TextEncoder().encode("<html><script>") };
    await expect(addReceipt(db, storage, alice, txId, html)).rejects.toThrow("photo");
    const big = { name: "big.pdf", bytes: new Uint8Array(MAX_RECEIPT_BYTES + 1) };
    await expect(addReceipt(db, storage, alice, txId, big)).rejects.toThrow("10 MB");
    await expect(addReceipt(db, storage, alice, txId, { name: "x", bytes: new Uint8Array() })).rejects.toThrow("empty");
  });

  it("keeps other users away from your receipts, but lets an admin in", async () => {
    await expect(addReceipt(db, storage, bob, txId, pdf("bob"))).rejects.toThrow("not found");
    const [receipt] = await db.receipt.findMany({ where: { transactionId: txId } });
    expect(await readReceipt(db, storage, bob, receipt.id)).toBeNull();
    await expect(deleteReceipt(db, storage, bob, receipt.id)).rejects.toThrow("not found");
    expect(await readReceipt(db, storage, admin, receipt.id)).not.toBeNull();
    const byAdmin = await addReceipt(db, storage, admin, txId, pdf("admin"));
    expect(byAdmin.uploadedById).toBe(admin.id);
  });

  it("cleans up the file name", async () => {
    const r = await addReceipt(db, storage, alice, txId, { ...pdf("name"), name: "../../etc/<market>.pdf" });
    expect(r.fileName).toBe(".._.._etc_market.pdf");
    expect(r.storageKey).toMatch(new RegExp(`^${txId}/[0-9a-f-]{36}\\.pdf$`));
  });

  it("deletes the receipt and its file", async () => {
    const [receipt] = await db.receipt.findMany({ where: { transactionId: txId }, orderBy: { uploadedAt: "asc" } });
    const before = await files();
    await deleteReceipt(db, storage, alice, receipt.id);
    expect(await db.receipt.findUnique({ where: { id: receipt.id } })).toBeNull();
    expect(await files()).toBe(before - 1);
    expect(await db.auditLog.findFirst({ where: { entityId: receipt.id, action: "DELETE" } })).not.toBeNull();
  });
});
