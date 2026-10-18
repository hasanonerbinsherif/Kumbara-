"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accountInput, createAccount } from "@/lib/accounts";
import { currentUser } from "@/lib/dal";
import { db } from "@/lib/db";

export type AccountFormState =
  | {
      errors?: Record<string, string[] | undefined>;
      values?: Record<string, string>;
      /** Changes on every response so the form remounts: cleared after a save, refilled after an error. */
      at: number;
    }
  | undefined;

export async function addAccount(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await currentUser();
  const values = {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    currency: String(formData.get("currency") ?? ""),
  };
  const parsed = accountInput.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values, at: Date.now() };

  await createAccount(db, user, parsed.data);
  revalidatePath("/accounts");
  return { at: Date.now() };
}
