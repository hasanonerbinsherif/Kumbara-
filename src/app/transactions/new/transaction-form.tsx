"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buttonClass, Field, inputClass } from "@/components/form";
import {
  COMMON_CURRENCIES,
  DIRECTION_LABELS,
  DIRECTIONS,
  type DirectionValue,
  METHOD_LABELS,
  METHODS,
} from "@/lib/labels";
import { addTransaction } from "../actions";

type AccountOption = { id: string; name: string; currency: string; ownerName?: string };

export function TransactionForm({
  accounts,
  defaultCurrency,
  today,
}: {
  accounts: AccountOption[];
  defaultCurrency: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(addTransaction, undefined);
  const v = state?.values;
  const e = state?.errors;
  const [direction, setDirection] = useState<DirectionValue>((v?.direction as DirectionValue) ?? "INCOMING");

  const showFrom = direction !== "INCOMING";
  const showTo = direction !== "OUTGOING";
  const label = (a: AccountOption) => `${a.name} (${a.currency})${a.ownerName ? ` · ${a.ownerName}` : ""}`;

  if (accounts.length === 0) {
    return (
      <p className="text-pink-800/80 dark:text-pink-200/80">
        You need an account first.{" "}
        <Link href="/accounts" className="font-medium text-pink-700 underline dark:text-pink-300">
          Add a piggy bank or wallet
        </Link>
        , then come back.
      </p>
    );
  }

  return (
    <form action={action} key={state?.at ?? 0} className="grid gap-5 rounded-xl border border-pink-200 bg-white p-5 sm:grid-cols-2 dark:border-pink-900 dark:bg-zinc-900">
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium text-pink-950 dark:text-pink-100">What happened?</legend>
        <div className="flex flex-wrap gap-2">
          {DIRECTIONS.map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-pink-200 px-3 py-2 text-sm has-[:checked]:border-pink-600 has-[:checked]:bg-pink-50 dark:border-pink-900 dark:text-pink-100 dark:has-[:checked]:bg-pink-950"
            >
              <input
                type="radio"
                name="direction"
                value={d}
                checked={direction === d}
                onChange={() => setDirection(d)}
                className="accent-pink-600"
              />
              {DIRECTION_LABELS[d]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Amount" error={e?.amount}>
        <input name="amount" required inputMode="decimal" placeholder="20.00" defaultValue={v?.amount} className={inputClass} />
      </Field>
      <Field label="Currency" error={e?.currency}>
        <input
          name="currency"
          required
          maxLength={3}
          list="currencies"
          defaultValue={v?.currency ?? defaultCurrency}
          className={`${inputClass} uppercase`}
        />
        <datalist id="currencies">
          {COMMON_CURRENCIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>

      <Field label="Who sent it?" error={e?.senderName}>
        <input name="senderName" required maxLength={120} placeholder="Ayşe" defaultValue={v?.senderName} className={inputClass} />
      </Field>
      <Field label="Who received it?" error={e?.recipientName} hint="Optional, for money paid to someone outside the app">
        <input name="recipientName" maxLength={120} defaultValue={v?.recipientName} className={inputClass} />
      </Field>

      {showFrom && (
        <Field label="From account" error={e?.fromAccountId}>
          <select name="fromAccountId" required defaultValue={v?.fromAccountId ?? ""} className={inputClass}>
            <option value="" disabled>
              Pick an account
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
              </option>
            ))}
          </select>
        </Field>
      )}
      {showTo && (
        <Field label="To account" error={e?.toAccountId}>
          <select name="toAccountId" required defaultValue={v?.toAccountId ?? ""} className={inputClass}>
            <option value="" disabled>
              Pick an account
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="How was it sent?" error={e?.method}>
        <select name="method" required defaultValue={v?.method ?? "CASH"} className={inputClass}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="When?" error={e?.occurredAt}>
        <input name="occurredAt" type="date" required max={today} defaultValue={v?.occurredAt ?? today} className={inputClass} />
      </Field>

      <div className="sm:col-span-2">
        <Field label="Note" error={e?.note} hint="Optional">
          <textarea name="note" rows={2} maxLength={500} defaultValue={v?.note} className={inputClass} />
        </Field>
      </div>

      {state?.formError && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-400">
          {state.formError}
        </p>
      )}
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save transaction"}
        </button>
        <Link href="/transactions" className="rounded-lg px-4 py-2 font-medium text-pink-800 hover:bg-pink-50 dark:text-pink-200 dark:hover:bg-pink-950">
          Cancel
        </Link>
      </div>
    </form>
  );
}
