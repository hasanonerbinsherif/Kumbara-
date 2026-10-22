import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Viewer } from "@/lib/access";
import { hashPassword } from "@/lib/password";
import { MIN_PASSWORD } from "@/lib/password-rules";

const password = z
  .string()
  .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters`)
  .max(200, "That password is too long");

export const userInput = z.object({
  name: z.string().trim().min(1, "Enter their name").max(80),
  email: z.email("Enter a valid email address").transform((email) => email.toLowerCase()),
  role: z.enum(["USER", "ADMIN"]).default("USER"),
  password,
});

export type UserInput = z.input<typeof userInput>;

export class UserError extends Error {}

function assertAdmin(viewer: Viewer) {
  if (viewer.role !== "ADMIN") throw new UserError("Only an Admin can manage users");
}

/** Only an Admin adds people; there is no public sign-up. */
export async function createUser(db: PrismaClient, viewer: Viewer, input: UserInput) {
  assertAdmin(viewer);
  const data = userInput.parse(input);
  if (await db.user.findUnique({ where: { email: data.email }, select: { id: true } })) {
    throw new UserError("Someone already uses that email");
  }
  const user = await db.user.create({
    data: { name: data.name, email: data.email, role: data.role, passwordHash: await hashPassword(data.password) },
    select: { id: true, name: true, email: true, role: true },
  });
  await db.auditLog.create({
    data: {
      actorId: viewer.id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      after: { name: user.name, email: user.email, role: user.role },
    },
  });
  return user;
}

/** Makes someone an Admin or a regular user. The last Admin can't be demoted, so the system is never locked. */
export async function setRole(db: PrismaClient, viewer: Viewer, userId: string, role: "USER" | "ADMIN") {
  assertAdmin(viewer);
  if (userId === viewer.id) throw new UserError("You can't change your own role");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new UserError("User not found");
  if (user.role === role) return user;
  if (role === "USER" && (await db.user.count({ where: { role: "ADMIN" } })) <= 1) {
    throw new UserError("There must be at least one Admin");
  }
  const updated = await db.user.update({ where: { id: userId }, data: { role }, select: { id: true, role: true } });
  await db.auditLog.create({
    data: {
      actorId: viewer.id,
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      before: { role: user.role },
      after: { role },
    },
  });
  return updated;
}

/** Sets a new password for someone who forgot theirs. The password itself is never logged. */
export async function resetPassword(db: PrismaClient, viewer: Viewer, userId: string, newPassword: string) {
  assertAdmin(viewer);
  const parsed = password.safeParse(newPassword);
  if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new UserError("User not found");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data) } });
  await db.auditLog.create({
    data: { actorId: viewer.id, action: "UPDATE", entity: "User", entityId: userId, after: { password: "reset" } },
  });
}

/** Everyone, with how much they have logged and when they last logged in. */
export async function listUsers(db: PrismaClient) {
  const [users, logins] = await Promise.all([
    db.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { accounts: true, transactions: { where: { deletedAt: null } } } },
      },
    }),
    db.auditLog.groupBy({ by: ["actorId"], where: { action: "LOGIN" }, _max: { at: true } }),
  ]);
  const lastLogin = new Map(logins.map((l) => [l.actorId, l._max.at]));
  return users.map((u) => ({ ...u, lastLoginAt: lastLogin.get(u.id) ?? null }));
}
