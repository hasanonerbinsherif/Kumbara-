import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/password";

const adminInput = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(12, "ADMIN_PASSWORD must be at least 12 characters"),
  name: z.string().min(1).default("Admin"),
});

export type AdminInput = z.input<typeof adminInput>;

/**
 * Makes sure an Admin with this email exists. Creates the account when it is
 * missing; when it already exists, promotes it to Admin but leaves its
 * password alone, so re-running the seed never resets anyone's password.
 */
export async function ensureAdmin(
  db: PrismaClient,
  input: AdminInput,
): Promise<{ id: string; created: boolean }> {
  const { email, password, name } = adminInput.parse(input);

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    }
    return { id: existing.id, created: false };
  }

  const user = await db.user.create({
    data: { email, name, role: "ADMIN", passwordHash: await hashPassword(password) },
  });
  return { id: user.id, created: true };
}
