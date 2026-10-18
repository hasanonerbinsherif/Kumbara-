import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/app/logout-button";
import { db } from "@/lib/db";
import { viewerScope } from "@/lib/dal";

export const metadata = { title: "Dashboard · Kumbara" };

async function Overview() {
  const { user, scope } = await viewerScope();
  const [accounts, transactions] = await Promise.all([
    db.account.count({ where: scope.accounts }),
    db.transaction.count({ where: { ...scope.transactions, deletedAt: null } }),
  ]);

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Hi, {user.name}</h1>
          <p className="text-sm text-pink-800/70 dark:text-pink-200/70">
            {user.role === "ADMIN" ? "Admin: you can see everyone's money." : "You can see your own money."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user.role === "ADMIN" && (
            <Link href="/admin" className="text-sm font-medium text-pink-700 underline dark:text-pink-300">
              Admin
            </Link>
          )}
          <LogoutButton />
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-4">
        <Stat label="Accounts" value={accounts} />
        <Stat label="Transactions" value={transactions} />
      </dl>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-pink-200 bg-white p-4 dark:border-pink-900 dark:bg-zinc-900">
      <dt className="text-sm text-pink-800/70 dark:text-pink-200/70">{label}</dt>
      <dd className="text-3xl font-semibold text-pink-900 dark:text-pink-100">{value}</dd>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Overview />
      </Suspense>
    </main>
  );
}
