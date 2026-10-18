import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { currentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { ACCOUNT_TYPE_LABELS, DIRECTION_LABELS, METHOD_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { getTransaction } from "@/lib/transactions";

export const metadata = { title: "Transaction · Kumbara" };

type Acc = { name: string; type: keyof typeof ACCOUNT_TYPE_LABELS; currency: string; owner: { name: string } } | null;

function accountLabel(account: Acc) {
  return account ? `${account.name} (${ACCOUNT_TYPE_LABELS[account.type]}, ${account.owner.name})` : null;
}

async function Detail({ params }: { params: PageProps<"/transactions/[id]">["params"] }) {
  const user = await currentUser();
  const { id } = await params;
  const tx = await getTransaction(db, user, id);
  if (!tx) notFound();

  const from = accountLabel(tx.fromAccount) ?? tx.senderName;
  const to = accountLabel(tx.toAccount) ?? tx.recipientName ?? "Someone outside the app";
  const rows: [string, React.ReactNode][] = [
    ["Who sent it", tx.senderName],
    ["From", from],
    ["To", to],
    ["How", METHOD_LABELS[tx.method]],
    ["When", tx.occurredAt.toISOString().slice(0, 10)],
    ["Note", tx.note ?? "—"],
    ["Logged by", `${tx.createdBy.name} on ${tx.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC`],
  ];

  return (
    <>
      <AppNav user={user} />
      <Link href="/transactions" className="text-sm font-medium text-pink-700 underline dark:text-pink-300">
        ← All transactions
      </Link>
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-pink-800/70 dark:text-pink-200/70">{DIRECTION_LABELS[tx.direction]}</p>
        <h1 className="text-4xl font-semibold text-pink-900 dark:text-pink-100">{formatMoney(tx.amount, tx.currency)}</h1>
        <p className="text-pink-800/80 dark:text-pink-200/80">
          {tx.senderName} sent {formatMoney(tx.amount, tx.currency)} to {to} by {METHOD_LABELS[tx.method].toLowerCase()}.
        </p>
      </header>
      <dl className="divide-y divide-pink-100 rounded-xl border border-pink-200 bg-white dark:divide-pink-950 dark:border-pink-900 dark:bg-zinc-900">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[10rem_1fr] gap-4 px-4 py-3 text-sm">
            <dt className="text-pink-800/70 dark:text-pink-200/70">{k}</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{v}</dd>
          </div>
        ))}
      </dl>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-pink-900 dark:text-pink-100">Receipts</h2>
        {tx.receipts.length === 0 ? (
          <p className="text-sm text-pink-800/70 dark:text-pink-200/70">No receipts yet. Uploading receipts comes in the next phase.</p>
        ) : (
          <ul className="text-sm">
            {tx.receipts.map((r) => (
              <li key={r.id}>{r.fileName}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function TransactionPage(props: PageProps<"/transactions/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Detail params={props.params} />
      </Suspense>
    </main>
  );
}
