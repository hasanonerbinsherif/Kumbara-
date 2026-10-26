import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { currencyField } from "@/lib/currency-field";
import { DIRECTION_LABELS, METHOD_LABELS } from "@/lib/labels";
import { isoDate, loadRateBook } from "@/lib/rates";

export const exportInput = z.object({
  currency: currencyField,
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});

export type ExportInput = z.infer<typeof exportInput>;

/**
 * Spreadsheet apps run cells that start with = + - @ as formulas, so a
 * sender called "=HYPERLINK(...)" could do harm. Prefix those with a quote.
 */
function cell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Every transaction in the system (Admins only), with its value in `currency`
 * on the day it happened and today. Values are blank where no rate exists.
 */
export async function exportTransactions(
  db: PrismaClient,
  base: string,
  { currency, from, to }: ExportInput,
  today = isoDate(new Date()),
) {
  const rows = await db.transaction.findMany({
    where: {
      deletedAt: null,
      occurredAt: {
        gte: from ? new Date(`${from}T00:00:00Z`) : undefined,
        lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
      },
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    include: {
      fromAccount: { select: { name: true } },
      toAccount: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
      _count: { select: { receipts: true } },
    },
  });

  const earliest = rows.length ? isoDate(rows[0].occurredAt) : today;
  const book = await loadRateBook(db, base, [currency, ...rows.map((r) => r.currency)], earliest, today);

  const header = [
    "Date",
    "Type",
    "Amount",
    "Currency",
    `Value then (${currency})`,
    "Rate date then",
    `Value today (${currency})`,
    "Rate date today",
    "Who sent it",
    "From",
    "To",
    "How",
    "Note",
    "Logged by",
    "Logged by email",
    "Receipts",
    "Transaction ID",
  ];
  const lines = rows.map((r) => {
    const day = isoDate(r.occurredAt);
    const then = book.convert(r.amount, r.currency, currency, day);
    const now = book.convert(r.amount, r.currency, currency, today);
    return [
      day,
      DIRECTION_LABELS[r.direction],
      r.amount.toFixed(2),
      r.currency,
      then?.value.toFixed(2),
      then?.rateDate,
      now?.value.toFixed(2),
      now?.rateDate,
      r.senderName,
      r.fromAccount?.name ?? r.senderName,
      r.toAccount?.name ?? r.recipientName ?? "",
      METHOD_LABELS[r.method],
      r.note,
      r.createdBy.name,
      r.createdBy.email,
      r._count.receipts,
      r.id,
    ];
  });
  return { csv: toCsv([header, ...lines]), count: rows.length };
}
