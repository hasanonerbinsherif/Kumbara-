import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { listAccounts } from "@/lib/accounts";
import { currentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import { AccountForm } from "./account-form";

export const metadata = { title: "Accounts · Kumbara" };

async function Accounts() {
  const user = await currentUser();
  const accounts = await listAccounts(db, user);
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <AppNav user={user} />
      <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Accounts</h1>
      <p className="-mt-6 text-sm text-pink-800/70 dark:text-pink-200/70">
        Piggy banks, wallets, bank accounts and cards that money goes into and out of.
      </p>
      <AccountForm defaultCurrency={env().HOME_CURRENCY} />
      {accounts.length === 0 ? (
        <p className="text-pink-800/70 dark:text-pink-200/70">No accounts yet. Add your first piggy bank above.</p>
      ) : (
        <ul className="divide-y divide-pink-100 rounded-xl border border-pink-200 bg-white dark:divide-pink-950 dark:border-pink-900 dark:bg-zinc-900">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{a.name}</p>
                <p className="text-sm text-pink-800/70 dark:text-pink-200/70">
                  {ACCOUNT_TYPE_LABELS[a.type]} · {a.currency}
                  {isAdmin ? ` · ${a.owner.name}` : ""}
                </p>
              </div>
              <a href={`/transactions?accountId=${a.id}`} className="text-sm font-medium text-pink-700 underline dark:text-pink-300">
                Transactions
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AccountsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Accounts />
      </Suspense>
    </main>
  );
}
