import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { ADMIN, SAVER } from "./users";

/**
 * Starts every run from the same place: a fresh test user with no money yet.
 * Plain SQL, because Playwright's loader can't import the generated Prisma client.
 */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (!ADMIN.password) throw new Error("ADMIN_PASSWORD is not set; run the seed and pass the same value");
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("BEGIN");
    const { rows } = await db.query<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [SAVER.email]);
    const old = rows[0]?.id;
    if (old) {
      const mine = `SELECT id FROM "Transaction" WHERE "createdById" = $1`;
      await db.query(`DELETE FROM "Receipt" WHERE "uploadedById" = $1 OR "transactionId" IN (${mine})`, [old]);
      await db.query(`DELETE FROM "Transaction" WHERE "createdById" = $1`, [old]);
      await db.query(`DELETE FROM "Account" WHERE "ownerId" = $1`, [old]);
      await db.query(`DELETE FROM "AuditLog" WHERE "actorId" = $1`, [old]);
      await db.query(`DELETE FROM "User" WHERE id = $1`, [old]);
    }
    await db.query(
      `INSERT INTO "User" (id, email, name, "passwordHash", role, "updatedAt") VALUES ($1, $2, $3, $4, 'USER', now())`,
      [`e2e_${randomUUID()}`, SAVER.email, SAVER.name, await bcrypt.hash(SAVER.password, 10)],
    );
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  } finally {
    await db.end();
  }
}
