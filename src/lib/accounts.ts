import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { type Viewer, scopeFor } from "@/lib/access";
import { currencyField } from "@/lib/currency-field";
import { ACCOUNT_TYPES } from "@/lib/labels";

export const accountInput = z.object({
  name: z.string().trim().min(1, "Give the account a name").max(80),
  type: z.enum(ACCOUNT_TYPES, { error: "Pick an account type" }),
  currency: currencyField,
});

export type AccountInput = z.input<typeof accountInput>;

export async function createAccount(db: PrismaClient, viewer: Viewer, input: AccountInput) {
  const data = accountInput.parse(input);
  const account = await db.account.create({ data: { ...data, ownerId: viewer.id } });
  await db.auditLog.create({
    data: { actorId: viewer.id, action: "CREATE", entity: "Account", entityId: account.id, after: data },
  });
  return account;
}

/** Accounts the viewer may see: their own, or everyone's for an Admin. */
export function listAccounts(db: PrismaClient, viewer: Viewer) {
  return db.account.findMany({
    where: scopeFor(viewer).accounts,
    orderBy: [{ name: "asc" }],
    include: { owner: { select: { name: true } } },
  });
}
