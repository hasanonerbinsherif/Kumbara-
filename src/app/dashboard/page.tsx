import Link from "next/link";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { buttonClass } from "@/components/form";
import { db } from "@/lib/db";
import { viewerScope } from "@/lib/dal";
import { env } from "@/lib/env";
import { Converter } from "./converter";

export const metadata = { title: "Dashboard · Kumbara" };

async function Overview({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const { user, scope } = await viewerScope();
  const [accounts, transactions] = await Promise.all([
    db.account.count({ where: scope.accounts }),
    db.transaction.count({ where: { AND: [scope.transactions, { deletedAt: null }] } }),
  ]);

  return (
    <>
      <AppNav user={user} />
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Hi, {user.name}</h1>
          <p className="text-sm text-pink-800/70 dark:text-pink-200/70">
            {user.role === "ADMIN" ? "Admin: you can see everyone's money." : "You can see your own money."}
          </p>
        </div>
        <Link href="/transactions/new" className={buttonClass}>
          New transaction
        </Link>
      </header>
      <dl className="grid grid-cols-2 gap-4">
        <Stat label="Accounts" value={accounts} href="/accounts" />
        <Stat label="Transactions" value={transactions} href="/transactions" />
      </dl>
      <Converter params={await searchParams} base={env().BASE_CURRENCY} home={env().HOME_CURRENCY} />
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-pink-200 bg-white p-4 hover:border-pink-400 dark:border-pink-900 dark:bg-zinc-900">
      <dt className="text-sm text-pink-800/70 dark:text-pink-200/70">{label}</dt>
      <dd className="text-3xl font-semibold text-pink-900 dark:text-pink-100">{value}</dd>
    </Link>
  );
}

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Overview searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
