"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { UserError, createUser, resetPassword, setRole, userInput } from "@/lib/users";

export type UserFormState =
  | {
      errors?: Record<string, string[] | undefined>;
      formError?: string;
      ok?: string;
      values?: Record<string, string>;
      at: number;
    }
  | undefined;

export async function addUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "USER"),
  };
  const parsed = userInput.safeParse({ ...values, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values, at: Date.now() };

  try {
    const user = await createUser(db, admin, parsed.data);
    revalidatePath("/admin/users");
    return { ok: `Added ${user.name}. Give them their email and password so they can log in.`, at: Date.now() };
  } catch (error) {
    if (error instanceof UserError) return { formError: error.message, values, at: Date.now() };
    throw error;
  }
}

export type RowState = { error?: string; ok?: string; at: number } | undefined;

export async function changeRole(_prev: RowState, formData: FormData): Promise<RowState> {
  const admin = await requireAdmin();
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "USER";
  try {
    await setRole(db, admin, String(formData.get("userId") ?? ""), role);
  } catch (error) {
    if (error instanceof UserError) return { error: error.message, at: Date.now() };
    throw error;
  }
  revalidatePath("/admin/users");
  return { ok: role === "ADMIN" ? "Now an Admin" : "Now a regular user", at: Date.now() };
}

export async function setPassword(_prev: RowState, formData: FormData): Promise<RowState> {
  const admin = await requireAdmin();
  try {
    await resetPassword(db, admin, String(formData.get("userId") ?? ""), String(formData.get("password") ?? ""));
  } catch (error) {
    if (error instanceof UserError) return { error: error.message, at: Date.now() };
    throw error;
  }
  return { ok: "Password changed", at: Date.now() };
}
