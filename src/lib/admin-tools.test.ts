import { describe, expect, it } from "vitest";
import { describeAction, describeChange, parseAuditFilters } from "@/lib/audit";
import { toCsv } from "@/lib/export";

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv([["a,b", 'say "hi"', "two\nlines", 3, null]])).toBe('"a,b","say ""hi""","two\nlines",3,\r\n');
  });

  it("stops spreadsheet formulas in text cells", () => {
    expect(toCsv([['=HYPERLINK("http://x")', "+1", "-cmd", "@SUM(A1)", "Grandma"]])).toBe(
      `"'=HYPERLINK(""http://x"")",'+1,'-cmd,'@SUM(A1),Grandma\r\n`,
    );
  });

  it("leaves numbers alone, negative ones included", () => {
    expect(toCsv([[-20, 1.5]])).toBe("-20,1.5\r\n");
  });
});

describe("describeChange", () => {
  it("shows what changed", () => {
    expect(describeChange({ role: "USER" }, { role: "ADMIN" })).toBe("role: USER → ADMIN");
    expect(describeChange(null, { name: "Piggy", currency: "USD" })).toBe("name: Piggy, currency: USD");
    expect(describeChange({ fileName: "a.pdf" }, null)).toBe("fileName: a.pdf");
    expect(describeChange(null, null)).toBe("");
  });
});

describe("describeAction", () => {
  it("reads like a sentence", () => {
    expect(describeAction("LOGIN", "User")).toBe("Logged in");
    expect(describeAction("CREATE", "Transaction")).toBe("Created transaction");
    expect(describeAction("EXPORT", "Transaction")).toBe("Exported transactions");
  });
});

describe("parseAuditFilters", () => {
  it("ignores unknown values and bad pages", () => {
    expect(parseAuditFilters({ action: "DROP", entity: "User", page: "-3" })).toEqual({ entity: "User", page: 1 });
    expect(parseAuditFilters({ page: "2", actorId: "u1" })).toEqual({ page: 2, actorId: "u1" });
  });
});
