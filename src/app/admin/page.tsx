import Link from "next/link";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { describeAction, describeChange } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { latestRateDate } from "@/lib/rates";
import { AdminNav, cardClass, mutedClass, tdClass, thClass, when } from "./admin-nav";

export const metadata = { title: "Admin · Kumbara" };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function Overview() {
  const admin = await requireAdmin();
  const [users, admins, accounts, transactions, receipts, latestRate, recent] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.account.count(),
    db.transaction.count({ where: { deletedAt: null } }),
    db.receipt.aggregate({ _count: true, _sum: { sizeBytes: true } }),
    latestRateDate(db, env().BASE_CURRENCY),
    db.auditLog.findMany({
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const stats = [
    { label: "Users", value: users, note: `${admins} Admin${admins === 1 ? "" : "s"}`, href: "/admin/users" },
    { label: "Accounts", value: accounts, note: "Everyone's", href: "/accounts" },
    { label: "Transactions", value: transactions, note: "Everyone's", href: "/transactions" },
    {
      label: "Receipts",
      value: receipts._count,
      note: formatBytes(receipts._sum.sizeBytes ?? 0),
      href: "/admin/receipts",
    },
  ];

  return (
    <>
      <AppNav user={admin} />
      <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Admin</h1>
      <AdminNav current="/admin" />
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`${cardClass} p-4 hover:border-pink-400`}>
            <dt className={`text-sm ${mutedClass}`}>{s.label}</dt>
            <dd className="text-3xl font-semibold text-pink-900 dark:text-pink-100">{s.value}</dd>
            <dd className={`text-xs ${mutedClass}`}>{s.note}</dd>
          </Link>
        ))}
      </dl>
      <p className={`text-sm ${mutedClass}`}>
        {latestRate
          ? `Exchange rates are up to ${latestRate}.`
          : "No exchange rates have been fetched yet. Run npm run rates:backfill once, then the daily job."}
      </p>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-pink-900 dark:text-pink-100">Latest activity</h2>
          <Link href="/admin/audit" className="text-sm font-medium text-pink-700 underline dark:text-pink-300">
            Full audit log
          </Link>
        </div>
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className={mutedClass}>
              <tr>
                <th className={thClass}>When (UTC)</th>
                <th className={thClass}>Who</th>
                <th className={thClass}>What</th>
                <th className={thClass}>Details</th>
              </tr>
            </thead>
            <tbody className="text-zinc-900 dark:text-zinc-100">
              {recent.map((e) => (
                <tr key={e.id} className="border-t border-pink-100 dark:border-pink-950">
                  <td className={`${tdClass} whitespace-nowrap`}>{when(e.at)}</td>
                  <td className={tdClass}>{e.actor.name}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{describeAction(e.action, e.entity)}</td>
                  <td className={`${tdClass} max-w-xs truncate ${mutedClass}`}>{describeChange(e.before, e.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Overview />
      </Suspense>
    </main>
  );
}
