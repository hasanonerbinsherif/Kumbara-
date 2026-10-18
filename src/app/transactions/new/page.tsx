import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { listAccounts } from "@/lib/accounts";
import { currentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { TransactionForm } from "./transaction-form";

export const metadata = { title: "New transaction · Kumbara" };

async function NewTransaction() {
  const user = await currentUser();
  const accounts = await listAccounts(db, user);
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <AppNav user={user} />
      <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">New transaction</h1>
      <TransactionForm
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          currency: a.currency,
          ownerName: isAdmin ? a.owner.name : undefined,
        }))}
        defaultCurrency={env().HOME_CURRENCY}
        today={new Date().toISOString().slice(0, 10)}
      />
    </>
  );
}

export default function NewTransactionPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <NewTransaction />
      </Suspense>
    </main>
  );
}
