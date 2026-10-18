"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { AccessError, createTransaction, transactionInput } from "@/lib/transactions";

export type TransactionFormState =
  | {
      errors?: Record<string, string[] | undefined>;
      formError?: string;
      values?: Record<string, string>;
      /** Changes on every response so the form remounts with the submitted values. */
      at: number;
    }
  | undefined;

const FIELDS = [
  "direction",
  "amount",
  "currency",
  "senderName",
  "recipientName",
  "fromAccountId",
  "toAccountId",
  "method",
  "occurredAt",
  "note",
] as const;

export async function addTransaction(
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const user = await currentUser();
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));

  const parsed = transactionInput.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values, at: Date.now() };

  let id: string;
  try {
    ({ id } = await createTransaction(db, user, parsed.data));
  } catch (error) {
    if (error instanceof AccessError) return { formError: "That account isn't one of yours.", values, at: Date.now() };
    throw error;
  }
  redirect(`/transactions/${id}`);
}
