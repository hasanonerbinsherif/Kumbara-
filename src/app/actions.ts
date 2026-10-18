"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { LOGIN_PATH, safeNextPath } from "@/lib/access";
import { checkCredentials } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSession, deleteSession, readSession } from "@/lib/session";

const loginForm = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginState = { error?: string; email?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginForm.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const user = await checkCredentials(db, parsed.data.email, parsed.data.password);
  if (!user) return { error: "Email or password is incorrect", email };

  await createSession({ userId: user.id, role: user.role });
  await db.auditLog.create({
    data: { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id },
  });
  redirect(safeNextPath(formData.get("next")));
}

export async function logout() {
  const session = await readSession();
  await deleteSession();
  if (session) {
    await db.auditLog
      .create({
        data: { actorId: session.userId, action: "LOGOUT", entity: "User", entityId: session.userId },
      })
      .catch(() => {});
  }
  redirect(LOGIN_PATH);
}
