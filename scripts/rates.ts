// Fetch exchange rates into the database.
//   npm run rates:sync                  everything since the last stored day
//   npm run rates:backfill -- 2025-01-01 [2025-12-31]   a date range (end defaults to today)
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseEnv } from "../src/lib/env";
import { frankfurter, isoDate, syncLatestRates, syncRates } from "../src/lib/rates";

async function main() {
  const { DATABASE_URL, RATES_API_URL, BASE_CURRENCY } = parseEnv(process.env);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
  const provider = frankfurter(RATES_API_URL);
  const [command, from, to = isoDate(new Date())] = process.argv.slice(2);
  try {
    if (command === "sync") {
      const result = await syncLatestRates(db, provider, BASE_CURRENCY);
      console.log(`Saved ${result.saved} new rates (${result.from} to ${result.to}).`);
    } else if (command === "backfill" && /^\d{4}-\d{2}-\d{2}$/.test(from ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const saved = await syncRates(db, provider, BASE_CURRENCY, { from, to });
      console.log(`Saved ${saved} new rates (${from} to ${to}).`);
    } else {
      console.error("Usage: tsx scripts/rates.ts sync | backfill YYYY-MM-DD [YYYY-MM-DD]");
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
