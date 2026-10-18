import type { PrismaClient } from "@/generated/prisma/client";
import { verifyPassword } from "@/lib/password";

// A real bcrypt hash of a random string. Comparing against it when the email
// is unknown makes a wrong email take as long as a wrong password, so login
// timing doesn't reveal which emails have accounts.
const DUMMY_HASH = "$2b$12$WXm0Fa3jR7V.sNuJaIGZ8OGWYSRExo7s09Hdv6vF/37sQW7KbBOuO";

export async function checkCredentials(db: PrismaClient, email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, role: true, passwordHash: true },
  });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return null;
  return { id: user.id, role: user.role };
}
