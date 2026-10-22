import { z } from "zod";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";

export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT"] as const;
export const AUDIT_ENTITIES = ["Transaction", "Receipt", "Account", "User"] as const;
export const AUDIT_PAGE_SIZE = 50;

export const auditFilters = z.object({
  action: z.enum(AUDIT_ACTIONS).optional().catch(undefined),
  entity: z.enum(AUDIT_ENTITIES).optional().catch(undefined),
  actorId: z.string().min(1).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});

export type AuditFilters = z.infer<typeof auditFilters>;

export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]),
  );
  return auditFilters.parse(flat);
}

/** Newest first, one page at a time. Only Admins reach this. */
export async function listAudit(db: PrismaClient, f: AuditFilters) {
  const where: Prisma.AuditLogWhereInput = { action: f.action, entity: f.entity, actorId: f.actorId };
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ at: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { entries, total, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}

/** A one-line, human summary of what changed, e.g. "role: USER → ADMIN". */
export function describeChange(before: unknown, after: unknown): string {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const show = (v: unknown) =>
    v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .map((k) => {
      if (!(k in b)) return `${k}: ${show(a[k])}`;
      if (!(k in a)) return `${k}: ${show(b[k])}`;
      return `${k}: ${show(b[k])} → ${show(a[k])}`;
    })
    .join(", ");
}

const PAST: Record<string, string> = { CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted" };

/** "Created transaction", "Logged in", "Exported transactions". */
export function describeAction(action: string, entity: string) {
  if (action === "LOGIN") return "Logged in";
  if (action === "LOGOUT") return "Logged out";
  if (action === "EXPORT") return `Exported ${entity.toLowerCase()}s`;
  return `${PAST[action] ?? action} ${entity.toLowerCase()}`;
}
