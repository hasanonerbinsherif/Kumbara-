import Link from "next/link";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { buttonClass, inputClass } from "@/components/form";
import { listAccounts } from "@/lib/accounts";
import { currentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { DIRECTION_LABELS, DIRECTIONS, METHOD_LABELS, METHODS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { listTransactions, parseFilters } from "@/lib/transactions";

export const metadata = { title: "Transactions · Kumbara" };

const day = (d: Date) => d.toISOString().slice(0, 10);

async function Transactions({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  const user = await currentUser();
  const filters = parseFilters(await searchParams);
  const [{ rows, totals }, accounts] = await Promise.all([
    listTransactions(db, user, filters),
    listAccounts(db, user),
  ]);
  const isAdmin = user.role === "ADMIN";
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <AppNav user={user} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Transactions</h1>
        <Link href="/transactions/new" className={buttonClass}>
          New transaction
        </Link>
      </div>

      <form className="grid grid-cols-2 gap-3 rounded-xl border border-pink-200 bg-white p-4 text-sm sm:grid-cols-3 lg:grid-cols-6 dark:border-pink-900 dark:bg-zinc-900">
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          From
          <input type="date" name="from" defaultValue={filters.from ? day(filters.from) : ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          To
          <input type="date" name="to" defaultValue={filters.to ? day(filters.to) : ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Type
          <select name="direction" defaultValue={filters.direction ?? ""} className={inputClass}>
            <option value="">All</option>
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {DIRECTION_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Method
          <select name="method" defaultValue={filters.method ?? ""} className={inputClass}>
            <option value="">All</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Account
          <select name="accountId" defaultValue={filters.accountId ?? ""} className={inputClass}>
            <option value="">All</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {isAdmin ? ` · ${a.owner.name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Currency
          <input name="currency" maxLength={3} defaultValue={filters.currency ?? ""} placeholder="Any" className={`${inputClass} uppercase placeholder:normal-case`} />
        </label>
        <div className="col-span-2 flex gap-3 sm:col-span-3 lg:col-span-6">
          <button type="submit" className={buttonClass}>
            Filter
          </button>
          {filtered && (
            <Link href="/transactions" className="self-center font-medium text-pink-700 underline dark:text-pink-300">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      {totals.length > 0 && (
        <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {totals.map((t) => (
            <div key={t.currency} className="rounded-xl border border-pink-200 bg-white p-4 dark:border-pink-900 dark:bg-zinc-900">
              <p className="text-sm font-medium text-pink-800/70 dark:text-pink-200/70">{t.currency}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-pink-800/60 dark:text-pink-200/60">In</dt>
                  <dd className="font-semibold text-emerald-700 dark:text-emerald-400">{formatMoney(t.incoming, t.currency)}</dd>
                </div>
                <div>
                  <dt className="text-pink-800/60 dark:text-pink-200/60">Out</dt>
                  <dd className="font-semibold text-red-700 dark:text-red-400">{formatMoney(t.outgoing, t.currency)}</dd>
                </div>
                <div>
                  <dt className="text-pink-800/60 dark:text-pink-200/60">Net</dt>
                  <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(t.net, t.currency)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </section>
      )}

      {rows.length === 0 ? (
        <p className="text-pink-800/70 dark:text-pink-200/70">
          {filtered ? "No transactions match these filters." : "No transactions yet. Log your first one."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-pink-200 bg-white dark:border-pink-900 dark:bg-zinc-900">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-pink-800/70 dark:text-pink-200/70">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Who sent</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">From → To</th>
                <th className="px-4 py-2 font-medium">How</th>
                {isAdmin && <th className="px-4 py-2 font-medium">Logged by</th>}
              </tr>
            </thead>
            <tbody className="text-zinc-900 dark:text-zinc-100">
              {rows.map((t) => {
                const sign = t.direction === "INCOMING" ? "+" : t.direction === "OUTGOING" ? "−" : "";
                const tone =
                  t.direction === "INCOMING"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : t.direction === "OUTGOING"
                      ? "text-red-700 dark:text-red-400"
                      : "";
                return (
                  <tr key={t.id} className="border-t border-pink-100 hover:bg-pink-50/60 dark:border-pink-950 dark:hover:bg-pink-950/40">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={`/transactions/${t.id}`} className="underline decoration-pink-300 underline-offset-2">
                        {day(t.occurredAt)}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{t.senderName}</td>
                    <td className={`px-4 py-2 text-right font-medium whitespace-nowrap ${tone}`}>
                      {sign}
                      {formatMoney(t.amount, t.currency)}
                    </td>
                    <td className="px-4 py-2">
                      {t.fromAccount?.name ?? t.senderName} → {t.toAccount?.name ?? t.recipientName ?? "outside"}
                    </td>
                    <td className="px-4 py-2">
                      {METHOD_LABELS[t.method]}
                      {t._count.receipts > 0 && <span title="Has receipts"> 🧾</span>}
                    </td>
                    {isAdmin && <td className="px-4 py-2">{t.createdBy.name}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 200 && (
        <p className="text-sm text-pink-800/70 dark:text-pink-200/70">Showing the latest 200. Narrow the filters to see older ones.</p>
      )}
    </>
  );
}

export default function TransactionsPage(props: PageProps<"/transactions">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Transactions searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
