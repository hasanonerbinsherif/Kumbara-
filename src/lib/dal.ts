import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { LOGIN_PATH, HOME_PATH, scopeFor } from "@/lib/access";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

/**
 * The logged-in user, confirmed against the database on every request so a
 * deleted or demoted user loses access straight away. Redirects to /login
 * when there is no valid session.
 */
export const currentUser = cache(async () => {
  const session = await readSession();
  if (!session) redirect(LOGIN_PATH);

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) redirect(LOGIN_PATH);
  return user;
});

export async function requireAdmin() {
  const user = await currentUser();
  if (user.role !== "ADMIN") redirect(HOME_PATH);
  return user;
}

/** The current user plus the filters that scope their queries. */
export async function viewerScope() {
  const user = await currentUser();
  return { user, scope: scopeFor(user) };
}
