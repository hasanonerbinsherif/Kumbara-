import Link from "next/link";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { buttonClass } from "@/components/form";
import { db } from "@/lib/db";
import { viewerScope } from "@/lib/dal";
import { Piggy } from "@/components/piggy";
import { piggyBalance } from "@/lib/balance";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { Converter } from "./converter";

export const metadata = { title: "Dashboard · Kumbara" };

async function Overview({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const { user, scope } = await viewerScope();
  const { BASE_CURRENCY, HOME_CURRENCY } = env();
  const [accounts, transactions, piggy] = await Promise.all([
    db.account.count({ where: scope.accounts }),
    db.transaction.count({ where: { AND: [scope.transactions, { deletedAt: null }] } }),
    piggyBalance(db, user, { base: BASE_CURRENCY, home: HOME_CURRENCY }),
  ]);
  const keptPct = Math.round(piggy.kept * 100);

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
      <section className="flex flex-col items-center gap-6 rounded-xl border border-pink-200 bg-white p-6 sm:flex-row dark:border-pink-900 dark:bg-zinc-900">
        <Piggy fill={piggy.kept} label={`Piggy bank ${keptPct}% full`} />
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <p className="text-sm text-pink-800/70 dark:text-pink-200/70">
            {user.role === "ADMIN" ? "Saved across everyone's accounts" : "Saved in your accounts"}, at today&apos;s rates
          </p>
          <p className="text-4xl font-semibold text-pink-900 dark:text-pink-100">
            {formatMoney(piggy.balance, piggy.currency)}
          </p>
          <p className="text-sm text-pink-800/80 dark:text-pink-200/80">
            {piggy.received.isZero()
              ? "Log money coming in and watch the piggy fill up."
              : `You've kept ${keptPct}% of the ${formatMoney(piggy.received, piggy.currency)} that came in.`}
          </p>
          {piggy.missing.length > 0 && (
            <p className="text-xs text-pink-800/60 dark:text-pink-200/60">
              Not counted (no exchange rate): {piggy.missing.join(", ")}
            </p>
          )}
        </div>
      </section>
      <dl className="grid grid-cols-2 gap-4">
        <Stat label="Accounts" value={accounts} href="/accounts" />
        <Stat label="Transactions" value={transactions} href="/transactions" />
      </dl>
      <Converter params={await searchParams} base={BASE_CURRENCY} home={HOME_CURRENCY} />
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
