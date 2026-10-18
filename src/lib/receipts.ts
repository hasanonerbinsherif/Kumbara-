import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { type Viewer, scopeFor } from "@/lib/access";
import type { FileStorage } from "@/lib/storage";

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

type Kind = { mime: string; ext: string };

/**
 * Works out the real file type from its first bytes rather than trusting the
 * browser, so a renamed .exe can't pose as a receipt photo.
 */
export function sniffReceiptType(bytes: Uint8Array): Kind | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  const ascii = (from: number, text: string) =>
    [...text].every((c, i) => bytes[from + i] === c.charCodeAt(0));

  if (starts(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png" };
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { mime: "image/webp", ext: "webp" };
  if (ascii(0, "%PDF-")) return { mime: "application/pdf", ext: "pdf" };
  if (ascii(4, "ftyp") && ["heic", "heix", "mif1", "msf1"].some((brand) => ascii(8, brand))) {
    return { mime: "image/heic", ext: "heic" };
  }
  return null;
}

export class ReceiptError extends Error {}

function cleanFileName(name: string, ext: string) {
  const base = name
    .replace(/[/\\]/g, "_")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "")
    .trim()
    .slice(0, 120);
  return base || `receipt.${ext}`;
}

/** The transaction, if the viewer may see it (and so add or view its receipts). */
function visibleTransaction(db: PrismaClient, viewer: Viewer, transactionId: string) {
  return db.transaction.findFirst({
    where: { AND: [scopeFor(viewer).transactions, { id: transactionId, deletedAt: null }] },
    select: { id: true },
  });
}

export async function addReceipt(
  db: PrismaClient,
  storage: FileStorage,
  viewer: Viewer,
  transactionId: string,
  file: { name: string; bytes: Uint8Array },
) {
  if (!(await visibleTransaction(db, viewer, transactionId))) throw new ReceiptError("Transaction not found");
  if (file.bytes.length === 0) throw new ReceiptError("The file is empty");
  if (file.bytes.length > MAX_RECEIPT_BYTES) throw new ReceiptError("Receipts can be up to 10 MB");

  const kind = sniffReceiptType(file.bytes);
  if (!kind) throw new ReceiptError("Upload a photo (JPEG, PNG, WebP, HEIC) or a PDF");

  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  const duplicate = await db.receipt.findFirst({ where: { transactionId, sha256 }, select: { id: true } });
  if (duplicate) throw new ReceiptError("This receipt is already attached");

  const storageKey = `${transactionId}/${randomUUID()}.${kind.ext}`;
  await storage.put(storageKey, file.bytes);
  try {
    const receipt = await db.receipt.create({
      data: {
        transactionId,
        storageKey,
        fileName: cleanFileName(file.name, kind.ext),
        mimeType: kind.mime,
        sizeBytes: file.bytes.length,
        sha256,
        uploadedById: viewer.id,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: viewer.id,
        action: "CREATE",
        entity: "Receipt",
        entityId: receipt.id,
        after: { transactionId, fileName: receipt.fileName, mimeType: kind.mime, sizeBytes: receipt.sizeBytes, sha256 },
      },
    });
    return receipt;
  } catch (error) {
    await storage.delete(storageKey); // don't leave an orphaned file behind
    throw error;
  }
}

/** A receipt and its bytes, only if the viewer may see its transaction. */
export async function readReceipt(db: PrismaClient, storage: FileStorage, viewer: Viewer, receiptId: string) {
  const receipt = await db.receipt.findFirst({
    where: { AND: [scopeFor(viewer).receipts, { id: receiptId, transaction: { deletedAt: null } }] },
  });
  if (!receipt) return null;
  const bytes = await storage.get(receipt.storageKey);
  return bytes ? { receipt, bytes } : null;
}

export async function deleteReceipt(db: PrismaClient, storage: FileStorage, viewer: Viewer, receiptId: string) {
  const receipt = await db.receipt.findFirst({ where: { AND: [scopeFor(viewer).receipts, { id: receiptId }] } });
  if (!receipt) throw new ReceiptError("Receipt not found");
  await db.receipt.delete({ where: { id: receipt.id } });
  await db.auditLog.create({
    data: {
      actorId: viewer.id,
      action: "DELETE",
      entity: "Receipt",
      entityId: receipt.id,
      before: { transactionId: receipt.transactionId, fileName: receipt.fileName, sha256: receipt.sha256 },
    },
  });
  await storage.delete(receipt.storageKey);
  return receipt;
}
