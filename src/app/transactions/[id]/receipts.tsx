"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/form";
import { type ReceiptFormState, removeReceipt, uploadReceipt } from "./actions";

type Receipt = { id: string; fileName: string; mimeType: string; sizeBytes: number; uploadedAt: Date };

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const PREVIEWABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export function Receipts({ transactionId, receipts }: { transactionId: string; receipts: Receipt[] }) {
  const [state, action, pending] = useActionState<ReceiptFormState, FormData>(uploadReceipt, undefined);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-pink-900 dark:text-pink-100">Receipts</h2>
      {receipts.length === 0 ? (
        <p className="text-sm text-pink-800/70 dark:text-pink-200/70">No receipts yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {receipts.map((r) => (
            <li
              key={r.id}
              className="flex flex-col overflow-hidden rounded-xl border border-pink-200 bg-white text-sm dark:border-pink-900 dark:bg-zinc-900"
            >
              <a href={`/receipts/${r.id}`} target="_blank" rel="noopener" className="block">
                {PREVIEWABLE.has(r.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private file behind auth, not for the image optimizer
                  <img src={`/receipts/${r.id}`} alt={r.fileName} className="h-32 w-full object-cover" />
                ) : (
                  <span className="flex h-32 items-center justify-center bg-pink-50 text-2xl font-semibold text-pink-700 dark:bg-pink-950 dark:text-pink-300">
                    {r.mimeType === "application/pdf" ? "PDF" : "HEIC"}
                  </span>
                )}
              </a>
              <div className="flex flex-col gap-1 p-2">
                <span className="truncate font-medium" title={r.fileName}>
                  {r.fileName}
                </span>
                <span className="text-xs text-pink-800/70 dark:text-pink-200/70">{formatSize(r.sizeBytes)}</span>
                <div className="flex gap-3 text-xs">
                  <a href={`/receipts/${r.id}?download`} className="text-pink-700 underline dark:text-pink-300">
                    Download
                  </a>
                  <form
                    action={removeReceipt}
                    onSubmit={(e) => {
                      if (!confirm(`Remove ${r.fileName}?`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="receiptId" value={r.id} />
                    <button type="submit" className="text-red-700 underline dark:text-red-400">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form key={state?.at} action={action} className="flex flex-col gap-2">
        <input type="hidden" name="transactionId" value={transactionId} />
        <label className="flex flex-col gap-1 text-sm font-medium text-pink-900 dark:text-pink-100">
          Add a receipt
          <input
            type="file"
            name="file"
            multiple
            required
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-pink-100 file:px-4 file:py-2 file:font-medium file:text-pink-800 dark:file:bg-pink-900 dark:file:text-pink-100"
          />
        </label>
        <p className="text-xs text-pink-800/70 dark:text-pink-200/70">Photos (JPEG, PNG, WebP, HEIC) or PDF, up to 10 MB each.</p>
        {state?.error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.error}
          </p>
        )}
        {state?.ok && <p className="text-sm text-green-700 dark:text-green-400">{state.ok}</p>}
        <button type="submit" disabled={pending} className={`${buttonClass} self-start`}>
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
    </section>
  );
}
