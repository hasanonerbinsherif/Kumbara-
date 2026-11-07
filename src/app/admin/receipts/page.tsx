import Link from "next/link";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { AdminNav, cardClass, mutedClass, tdClass, thClass, when } from "../admin-nav";

export const metadata = { title: "Receipts · Admin · Kumbara" };

const LIMIT = 200;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function Receipts() {
  const admin = await requireAdmin();
  const receipts = await db.receipt.findMany({
    where: { transaction: { deletedAt: null } },
    orderBy: { uploadedAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedAt: true,
      uploadedBy: { select: { name: true } },
      transaction: { select: { id: true, amount: true, currency: true, senderName: true, occurredAt: true } },
    },
  });

  return (
    <>
      <AppNav user={admin} />
      <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Receipts</h1>
      <AdminNav current="/admin/receipts" />
      {receipts.length === 0 ? (
        <p className={mutedClass}>No receipts have been uploaded yet.</p>
      ) : (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className={mutedClass}>
              <tr>
                <th className={thClass}>File</th>
                <th className={thClass}>Transaction</th>
                <th className={thClass}>Uploaded by</th>
                <th className={thClass}>When (UTC)</th>
                <th className={`${thClass} text-right`}>Size</th>
              </tr>
            </thead>
            <tbody className="text-zinc-900 dark:text-zinc-100">
              {receipts.map((r) => (
                <tr key={r.id} className="border-t border-pink-100 dark:border-pink-950">
                  <td className={`${tdClass} max-w-[16rem] truncate`}>
                    <a
                      href={`/receipts/${r.id}`}
                      target="_blank"
                      rel="noopener"
                      title={r.fileName}
                      className="underline decoration-pink-300 underline-offset-2"
                    >
                      {r.fileName}
                    </a>
                  </td>
                  <td className={tdClass}>
                    <Link
                      href={`/transactions/${r.transaction.id}`}
                      className="underline decoration-pink-300 underline-offset-2"
                    >
                      {formatMoney(r.transaction.amount, r.transaction.currency)} from {r.transaction.senderName}
                    </Link>
                    <div className={`text-xs ${mutedClass}`}>{r.transaction.occurredAt.toISOString().slice(0, 10)}</div>
                  </td>
                  <td className={tdClass}>{r.uploadedBy.name}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{when(r.uploadedAt)}</td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>{formatBytes(r.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {receipts.length === LIMIT && <p className={`text-sm ${mutedClass}`}>Showing the latest {LIMIT}.</p>}
    </>
  );
}

export default function AdminReceiptsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Receipts />
      </Suspense>
    </main>
  );
}
