import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { type Viewer, scopeFor } from "@/lib/access";
import { isoDate, loadRateBook } from "@/lib/rates";

export type PiggyBalance = {
  currency: string;
  /** Money in your accounts now: everything that came in minus everything that went out. */
  balance: Prisma.Decimal;
  /** Everything that ever came into your accounts from outside. */
  received: Prisma.Decimal;
  /** Share of what came in that is still saved, 0–1. */
  kept: number;
  /** Currencies left out because there is no exchange rate for them. */
  missing: string[];
};

/**
 * The viewer's savings in one currency, at today's rates. Transfers between
 * your own accounts add and subtract the same amount, so they cancel out.
 */
export async function piggyBalance(
  db: PrismaClient,
  viewer: Viewer,
  { base, home, today = isoDate(new Date()) }: { base: string; home: string; today?: string },
): Promise<PiggyBalance> {
  const mine = scopeFor(viewer).accounts;
  const [ins, outs, received] = await Promise.all([
    db.transaction.groupBy({
      by: ["currency"],
      where: { deletedAt: null, toAccount: { is: mine } },
      _sum: { amount: true },
    }),
    db.transaction.groupBy({
      by: ["currency"],
      where: { deletedAt: null, fromAccount: { is: mine } },
      _sum: { amount: true },
    }),
    db.transaction.groupBy({
      by: ["currency"],
      where: { deletedAt: null, direction: "INCOMING", toAccount: { is: mine } },
      _sum: { amount: true },
    }),
  ]);

  const currencies = [...new Set([...ins, ...outs].map((r) => r.currency))];
  const book = await loadRateBook(db, base, [home, ...currencies], today, today);
  const missing = new Set<string>();
  const total = (rows: { currency: string; _sum: { amount: Prisma.Decimal | null } }[]) =>
    rows.reduce((sum, r) => {
      const c = book.convert(r._sum.amount ?? 0, r.currency, home, today);
      if (!c) missing.add(r.currency);
      return c ? sum.plus(c.value) : sum;
    }, new Prisma.Decimal(0));

  const balance = total(ins).minus(total(outs));
  const got = total(received);
  const kept = got.isZero() ? 0 : Math.min(1, Math.max(0, balance.div(got).toNumber()));
  return { currency: home, balance, received: got, kept, missing: [...missing].sort() };
}
