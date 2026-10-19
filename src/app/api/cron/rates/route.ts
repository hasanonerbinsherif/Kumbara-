import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { frankfurter, syncLatestRates } from "@/lib/rates";

function authorized(header: string | null, secret: string) {
  const given = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The daily rates job. A scheduler calls it with "Authorization: Bearer $CRON_SECRET". */
export async function GET(request: Request) {
  await connection();
  const { CRON_SECRET, RATES_API_URL, BASE_CURRENCY } = env();
  if (!CRON_SECRET) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"), CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncLatestRates(db, frankfurter(RATES_API_URL), BASE_CURRENCY);
    return Response.json({ status: "ok", ...result });
  } catch (error) {
    console.error("Rates sync failed", error);
    return Response.json({ status: "error", error: String(error) }, { status: 502 });
  }
}
