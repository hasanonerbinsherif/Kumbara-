import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { exportInput, exportTransactions } from "@/lib/export";
import { isoDate } from "@/lib/rates";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = exportInput.safeParse({ ...params, from: params.from || undefined, to: params.to || undefined });
  if (!parsed.success) return new Response(parsed.error.issues[0].message, { status: 400 });

  const { csv, count } = await exportTransactions(db, env().BASE_CURRENCY, parsed.data);
  await db.auditLog.create({
    data: {
      actorId: admin.id,
      action: "EXPORT",
      entity: "Transaction",
      entityId: "*",
      after: { ...parsed.data, rows: count },
    },
  });

  const name = `kumbara-transactions-${parsed.data.currency}-${isoDate(new Date())}.csv`;
  // A byte-order mark so Excel reads names like "Ayşe" as UTF-8.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
