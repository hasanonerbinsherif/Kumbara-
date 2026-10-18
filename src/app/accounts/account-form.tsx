"use client";

import { useActionState } from "react";
import { buttonClass, Field, inputClass } from "@/components/form";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, COMMON_CURRENCIES } from "@/lib/labels";
import { addAccount } from "./actions";

export function AccountForm({ defaultCurrency }: { defaultCurrency: string }) {
  const [state, action, pending] = useActionState(addAccount, undefined);
  const v = state?.values;

  return (
    <form
      action={action}
      key={state?.at ?? 0}
      className="grid gap-4 rounded-xl border border-pink-200 bg-white p-4 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-start dark:border-pink-900 dark:bg-zinc-900"
    >
      <Field label="Name" error={state?.errors?.name}>
        <input name="name" required maxLength={80} defaultValue={v?.name} placeholder="Hilal's piggy bank" className={inputClass} />
      </Field>
      <Field label="Type" error={state?.errors?.type}>
        <select name="type" defaultValue={v?.type ?? "PIGGY_BANK"} className={inputClass}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Currency" error={state?.errors?.currency}>
        <input
          name="currency"
          required
          list="currencies"
          maxLength={3}
          defaultValue={v?.currency ?? defaultCurrency}
          className={`${inputClass} uppercase`}
        />
        <datalist id="currencies">
          {COMMON_CURRENCIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <button type="submit" disabled={pending} className={`${buttonClass} sm:mt-6`}>
        {pending ? "Adding…" : "Add account"}
      </button>
    </form>
  );
}
