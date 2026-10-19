import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { type Viewer, scopeFor } from "@/lib/access";
import { currencyField } from "@/lib/currency-field";
import { DIRECTIONS, METHODS } from "@/lib/labels";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

export const transactionInput = z
  .object({
    direction: z.enum(DIRECTIONS, { error: "Pick whether money came in, went out or moved" }),
    amount: z
      .string()
      .trim()
      .regex(/^\d{1,14}(\.\d{1,4})?$/, "Enter an amount like 20 or 20.50")
      .refine((v) => Number(v) > 0, "The amount must be more than zero"),
    currency: currencyField,
    senderName: z.string().trim().min(1, "Say who sent the money").max(120),
    recipientName: optionalText(120),
    fromAccountId: optionalId,
    toAccountId: optionalId,
    method: z.enum(METHODS, { error: "Pick how the money was sent" }),
    occurredAt: z.coerce.date({ error: "Enter when the money moved" }),
    note: optionalText(500),
  })
  .superRefine((tx, ctx) => {
    if (tx.direction === "INCOMING" && !tx.toAccountId) {
      ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Pick the account the money went into" });
    }
    if (tx.direction === "OUTGOING" && !tx.fromAccountId) {
      ctx.addIssue({ code: "custom", path: ["fromAccountId"], message: "Pick the account the money came out of" });
    }
    if (tx.direction === "TRANSFER") {
      if (!tx.fromAccountId || !tx.toAccountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "A transfer needs both accounts" });
      } else if (tx.fromAccountId === tx.toAccountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Pick two different accounts" });
      }
    }
    if (tx.occurredAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      ctx.addIssue({ code: "custom", path: ["occurredAt"], message: "The date can't be in the future" });
    }
  });

export type TransactionInput = z.input<typeof transactionInput>;

export class AccessError extends Error {}

export async function createTransaction(db: PrismaClient, viewer: Viewer, input: TransactionInput) {
  const data = transactionInput.parse(input);

  // Only accounts the viewer can see may be used, so nobody logs money into
  // someone else's piggy bank.
  const accountIds = [data.fromAccountId, data.toAccountId].filter((id): id is string => !!id);
  if (accountIds.length) {
    const visible = await db.account.count({
      where: { AND: [scopeFor(viewer).accounts, { id: { in: accountIds } }] },
    });
    if (visible !== new Set(accountIds).size) throw new AccessError("Account not found");
  }

  const tx = await db.transaction.create({ data: { ...data, createdById: viewer.id } });
  await db.auditLog.create({
    data: {
      actorId: viewer.id,
      action: "CREATE",
      entity: "Transaction",
      entityId: tx.id,
      after: { ...data, occurredAt: data.occurredAt.toISOString() },
    },
  });
  return tx;
}

export const transactionFilters = z.object({
  from: z.coerce.date().optional().catch(undefined),
  to: z.coerce.date().optional().catch(undefined),
  direction: z.enum(DIRECTIONS).optional().catch(undefined),
  method: z.enum(METHODS).optional().catch(undefined),
  currency: z
    .string()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .optional()
    .catch(undefined),
  accountId: z.string().min(1).optional().catch(undefined),
});

export type TransactionFilters = z.infer<typeof transactionFilters>;

/** Reads filters from URL search params, ignoring anything malformed. */
export function parseFilters(params: Record<string, string | string[] | undefined>): TransactionFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]),
  );
  return transactionFilters.parse(flat);
}

function whereFor(viewer: Viewer, f: TransactionFilters): Prisma.TransactionWhereInput {
  const to = f.to ? new Date(f.to.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined; // include the whole "to" day
  return {
    AND: [
      scopeFor(viewer).transactions,
      { deletedAt: null },
      f.from || to ? { occurredAt: { gte: f.from, lte: to } } : {},
      f.direction ? { direction: f.direction } : {},
      f.method ? { method: f.method } : {},
      f.currency ? { currency: f.currency } : {},
      f.accountId ? { OR: [{ fromAccountId: f.accountId }, { toAccountId: f.accountId }] } : {},
    ],
  };
}

export type CurrencyTotals = { currency: string; incoming: string; outgoing: string; net: string };

export async function listTransactions(db: PrismaClient, viewer: Viewer, filters: TransactionFilters) {
  const where = whereFor(viewer, filters);
  const [rows, sums] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { receipts: true } },
      },
    }),
    // Transfers move money between your own accounts, so they don't change the totals.
    db.transaction.groupBy({
      by: ["currency", "direction"],
      where: { AND: [where, { direction: { not: "TRANSFER" } }] },
      _sum: { amount: true },
    }),
  ]);

  const byCurrency = new Map<string, { incoming: Prisma.Decimal; outgoing: Prisma.Decimal }>();
  for (const s of sums) {
    const t = byCurrency.get(s.currency) ?? { incoming: new Prisma.Decimal(0), outgoing: new Prisma.Decimal(0) };
    const amount = s._sum.amount ?? new Prisma.Decimal(0);
    if (s.direction === "INCOMING") t.incoming = t.incoming.plus(amount);
    if (s.direction === "OUTGOING") t.outgoing = t.outgoing.plus(amount);
    byCurrency.set(s.currency, t);
  }
  const totals: CurrencyTotals[] = [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, t]) => ({
      currency,
      incoming: t.incoming.toFixed(2),
      outgoing: t.outgoing.toFixed(2),
      net: t.incoming.minus(t.outgoing).toFixed(2),
    }));

  return { rows, totals };
}

/** One transaction the viewer may see, with everything the detail page shows, or null. */
export function getTransaction(db: PrismaClient, viewer: Viewer, id: string) {
  return db.transaction.findFirst({
    where: { AND: [scopeFor(viewer).transactions, { id, deletedAt: null }] },
    include: {
      fromAccount: { include: { owner: { select: { name: true } } } },
      toAccount: { include: { owner: { select: { name: true } } } },
      createdBy: { select: { name: true, email: true } },
      receipts: {
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploadedAt: true },
        orderBy: { uploadedAt: "asc" },
      },
    },
  });
}
