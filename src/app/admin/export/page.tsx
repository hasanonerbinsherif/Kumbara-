import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { buttonClass, inputClass } from "@/components/form";
import { requireAdmin } from "@/lib/dal";
import { env } from "@/lib/env";
import { COMMON_CURRENCIES } from "@/lib/labels";
import { AdminNav, cardClass, mutedClass } from "../admin-nav";

export const metadata = { title: "Export · Admin · Kumbara" };

async function Export() {
  const admin = await requireAdmin();
  return (
    <>
      <AppNav user={admin} />
      <h1 className="text-2xl font-semibold text-pink-900 dark:text-pink-100">Export</h1>
      <AdminNav current="/admin/export" />
      <p className={`text-sm ${mutedClass}`}>
        Download every transaction as a CSV file for Excel or Google Sheets. Each row includes its value in the currency
        you pick, both on the day it happened and today, using European Central Bank rates. Leave the dates empty to
        export everything.
      </p>
      <form action="/admin/export/csv" className={`${cardClass} grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4`}>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Values in
          <input
            name="currency"
            required
            list="export-currencies"
            maxLength={3}
            defaultValue={env().HOME_CURRENCY}
            className={`${inputClass} uppercase`}
          />
          <datalist id="export-currencies">
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          From
          <input name="from" type="date" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          To
          <input name="to" type="date" className={inputClass} />
        </label>
        <button type="submit" className={`${buttonClass} self-end`}>
          Download CSV
        </button>
      </form>
    </>
  );
}

export default function ExportPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Suspense fallback={<p className="text-pink-800/70">Loading…</p>}>
        <Export />
      </Suspense>
    </main>
  );
}
