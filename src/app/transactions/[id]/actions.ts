"use server";

import { refresh } from "next/cache";
import { currentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { ReceiptError, addReceipt, deleteReceipt } from "@/lib/receipts";
import { receiptStorage } from "@/lib/storage";

export type ReceiptFormState = { error?: string; ok?: string; at: number } | undefined;

export async function uploadReceipt(_prev: ReceiptFormState, formData: FormData): Promise<ReceiptFormState> {
  const user = await currentUser();
  const transactionId = String(formData.get("transactionId") ?? "");
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose a photo or PDF of the receipt", at: Date.now() };

  const problems: string[] = [];
  let added = 0;
  for (const file of files) {
    try {
      await addReceipt(db, receiptStorage(), user, transactionId, {
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      added++;
    } catch (error) {
      if (!(error instanceof ReceiptError)) throw error;
      problems.push(files.length > 1 ? `${file.name}: ${error.message}` : error.message);
    }
  }
  if (added > 0) refresh();
  return {
    error: problems.length ? problems.join(". ") : undefined,
    ok: added ? `Added ${added} receipt${added > 1 ? "s" : ""}` : undefined,
    at: Date.now(),
  };
}

export async function removeReceipt(formData: FormData) {
  const user = await currentUser();
  try {
    await deleteReceipt(db, receiptStorage(), user, String(formData.get("receiptId") ?? ""));
  } catch (error) {
    if (!(error instanceof ReceiptError)) throw error;
  }
  refresh();
}
