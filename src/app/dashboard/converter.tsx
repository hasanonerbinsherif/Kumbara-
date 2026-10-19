import { inputClass, buttonClass } from "@/components/form";
import { RateChart } from "@/components/rate-chart";
import { formatChange } from "@/components/worth";
import { db } from "@/lib/db";
import { COMMON_CURRENCIES } from "@/lib/labels";
import { formatMoney, isCurrencyCode } from "@/lib/money";
import { addDays, isoDate, latestRateDate, loadRateBook } from "@/lib/rates";

const HISTORY_DAYS = 90;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/** Reads the converter form from the URL, falling back to sensible defaults for anything missing or malformed. */
export function parseConverter(params: Params, home: string, base: string, today: string, defaultOn: string) {
  const amount = Number(one(params.amount));
  const from = one(params.from).toUpperCase();
  const to = one(params.to).toUpperCase();
  const on = one(params.on);
  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : 20,
    from: isCurrencyCode(from) ? from : base,
    to: isCurrencyCode(to) ? to : home,
    on: /^\d{4}-\d{2}-\d{2}$/.test(on) && on <= today ? on : defaultOn,
  };
}

/**
 * "Yesterday" for the default comparison: the business day before the latest
 * rate, since the ECB publishes nothing at weekends and a Sunday-vs-Monday
 * comparison would always show no change.
 */
export function previousRateDay(latest: string) {
  let day = addDays(latest, -1);
  while ([0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())) day = addDays(day, -1);
  return day;
}

/** "What was it worth then vs today", plus the rate history for the pair. */
export async function Converter({ params, base, home }: { params: Params; base: string; home: string }) {
  const today = isoDate(new Date());
  const latest = await latestRateDate(db, base);
  const q = parseConverter(params, home, base, today, previousRateDay(latest ?? today));
  const earliest = [q.on, addDays(today, -HISTORY_DAYS)].sort()[0];
  const book = await loadRateBook(db, base, [q.from, q.to], earliest, today);
  const then = book.convert(q.amount, q.from, q.to, q.on);
  const now = book.convert(q.amount, q.from, q.to, today);
  const history = book
    .history(q.from, q.to, addDays(today, -HISTORY_DAYS), today)
    .map((p) => ({ date: p.date, rate: p.rate.toNumber() }));

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-pink-200 bg-white p-4 dark:border-pink-900 dark:bg-zinc-900">
      <h2 className="font-semibold text-pink-900 dark:text-pink-100">Then vs today</h2>
      <form className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Amount
          <input name="amount" type="number" min="0" step="any" defaultValue={q.amount} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          From
          <input
            name="from"
            list="converter-currencies"
            maxLength={3}
            defaultValue={q.from}
            className={`${inputClass} uppercase`}
          />
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          To
          <input
            name="to"
            list="converter-currencies"
            maxLength={3}
            defaultValue={q.to}
            className={`${inputClass} uppercase`}
          />
        </label>
        <label className="flex flex-col gap-1 text-pink-950 dark:text-pink-100">
          Then
          <input name="on" type="date" max={today} defaultValue={q.on} className={inputClass} />
        </label>
        <button type="submit" className={`${buttonClass} col-span-2 self-end sm:col-span-1`}>
          Compare
        </button>
        <datalist id="converter-currencies">
          {COMMON_CURRENCIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </form>

      {!latest ? (
        <p className="text-sm text-pink-800/70 dark:text-pink-200/70">
          No exchange rates have been fetched yet, so nothing can be compared.
        </p>
      ) : then && now ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Figure label={`On ${q.on}`} value={formatMoney(then.value, q.to)} note={`rate of ${then.rateDate}`} />
          <Figure label="Today" value={formatMoney(now.value, q.to)} note={`rate of ${now.rateDate}`} />
          <Figure
            label="Change"
            value={`${now.value.minus(then.value).isNegative() ? "−" : "+"}${formatMoney(now.value.minus(then.value).abs(), q.to)}`}
            note={formatChange(now.value.div(then.value).minus(1).toNumber())}
          />
        </div>
      ) : (
        <p className="text-sm text-pink-800/70 dark:text-pink-200/70">
          There is no {[q.from, q.to].filter((c) => !book.rateOn(c, then ? today : q.on)).join(" or ")} rate{" "}
          {then ? "for today" : `around ${q.on}`}. Rates come from the European Central Bank, which doesn&apos;t cover
          every currency.
        </p>
      )}
      {latest && <RateChart points={history} from={q.from} to={q.to} />}
      {latest && (
        <p className="text-xs text-pink-800/60 dark:text-pink-200/60">
          European Central Bank reference rates, latest from {latest}.
        </p>
      )}
    </section>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-pink-800/70 dark:text-pink-200/70">{label}</span>
      <span className="text-2xl font-semibold text-pink-900 dark:text-pink-100">{value}</span>
      <span className="text-xs text-pink-800/60 dark:text-pink-200/60">{note}</span>
    </div>
  );
}
