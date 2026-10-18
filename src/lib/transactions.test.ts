import { describe, expect, it } from "vitest";
import { parseFilters, transactionInput } from "./transactions";

const base = {
  direction: "INCOMING",
  amount: "20",
  currency: "usd",
  senderName: " Ayşe ",
  toAccountId: "acc-1",
  method: "CASH",
  occurredAt: "2026-10-17",
};

const issues = (input: Record<string, unknown>) => {
  const r = transactionInput.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("transactionInput", () => {
  it("cleans up a valid incoming transaction", () => {
    const tx = transactionInput.parse({ ...base, recipientName: "", fromAccountId: "", note: "  " });
    expect(tx).toMatchObject({ currency: "USD", senderName: "Ayşe", toAccountId: "acc-1", amount: "20" });
    expect(tx.fromAccountId).toBeUndefined();
    expect(tx.recipientName).toBeUndefined();
    expect(tx.note).toBeUndefined();
    expect(tx.occurredAt.toISOString()).toBe("2026-10-17T00:00:00.000Z");
  });

  it("accepts up to 4 decimal places and refuses zero, negatives and junk", () => {
    expect(issues({ ...base, amount: "20.1234" })).toEqual([]);
    for (const amount of ["0", "0.00", "-5", "20.12345", "1e3", "abc", ""]) {
      expect(issues({ ...base, amount })).toContain("amount");
    }
  });

  it("needs the right accounts for each direction", () => {
    expect(issues({ ...base, toAccountId: "" })).toContain("toAccountId");
    expect(issues({ ...base, direction: "OUTGOING", toAccountId: "" })).toContain("fromAccountId");
    expect(issues({ ...base, direction: "OUTGOING", fromAccountId: "acc-1", toAccountId: "" })).toEqual([]);
    expect(issues({ ...base, direction: "TRANSFER", fromAccountId: "" })).toContain("toAccountId");
    expect(issues({ ...base, direction: "TRANSFER", fromAccountId: "acc-1" })).toContain("toAccountId");
    expect(issues({ ...base, direction: "TRANSFER", fromAccountId: "acc-2" })).toEqual([]);
  });

  it("refuses unknown methods, bad currencies, empty senders and future dates", () => {
    expect(issues({ ...base, method: "CHEQUE" })).toContain("method");
    expect(issues({ ...base, currency: "dollars" })).toContain("currency");
    expect(issues({ ...base, currency: "DOL" })).toContain("currency");
    expect(issues({ ...base, currency: " try " })).toEqual([]);
    expect(issues({ ...base, senderName: "   " })).toContain("senderName");
    expect(issues({ ...base, occurredAt: "2999-01-01" })).toContain("occurredAt");
  });
});

describe("parseFilters", () => {
  it("reads valid filters and drops malformed ones", () => {
    const f = parseFilters({
      from: "2026-10-01",
      to: "not-a-date",
      method: "CASH",
      direction: "SIDEWAYS",
      currency: "try",
      accountId: "",
    });
    expect(f.from?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(f.to).toBeUndefined();
    expect(f.method).toBe("CASH");
    expect(f.direction).toBeUndefined();
    expect(f.currency).toBe("TRY");
    expect(f.accountId).toBeUndefined();
  });

  it("takes the first value of a repeated param", () => {
    expect(parseFilters({ method: ["CARD", "CASH"] }).method).toBe("CARD");
  });
});
