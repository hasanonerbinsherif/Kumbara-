import type { Role, SessionPayload } from "./session-token";

export const HOME_PATH = "/dashboard";
export const LOGIN_PATH = "/login";

/** Pages anyone can open without logging in. */
const PUBLIC_PATHS = new Set(["/", LOGIN_PATH]);

export type RouteDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string };

/**
 * The proxy's optimistic check, from the session cookie alone. Pages and
 * actions still confirm the user against the database (see dal.ts).
 */
export function decideRoute(pathname: string, session: SessionPayload | null): RouteDecision {
  if (pathname === LOGIN_PATH && session) return { kind: "redirect", to: HOME_PATH };
  if (PUBLIC_PATHS.has(pathname)) return { kind: "allow" };
  if (!session) {
    return { kind: "redirect", to: `${LOGIN_PATH}?next=${encodeURIComponent(pathname)}` };
  }
  if (isAdminPath(pathname) && session.role !== "ADMIN") return { kind: "redirect", to: HOME_PATH };
  return { kind: "allow" };
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Only same-site paths are allowed after login, so ?next= can't send people elsewhere. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return HOME_PATH;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return HOME_PATH;
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`)) return HOME_PATH;
  return next;
}

export type Viewer = { id: string; role: Role };

/**
 * Prisma `where` fragments that limit a regular user to their own records.
 * Admins get empty filters, so they see everything. Every query for user
 * data must go through these.
 */
export function scopeFor(viewer: Viewer) {
  const isAdmin = viewer.role === "ADMIN";
  return {
    accounts: isAdmin ? {} : { ownerId: viewer.id },
    transactions: isAdmin ? {} : { createdById: viewer.id },
    receipts: isAdmin ? {} : { transaction: { createdById: viewer.id } },
  };
}
