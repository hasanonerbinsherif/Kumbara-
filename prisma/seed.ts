import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ensureAdmin } from "../src/lib/admin";

async function main() {
  const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first Admin");
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  try {
    const { created } = await ensureAdmin(db, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME || undefined,
    });
    console.log(created ? `Created Admin ${ADMIN_EMAIL}` : `Admin ${ADMIN_EMAIL} already exists`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
