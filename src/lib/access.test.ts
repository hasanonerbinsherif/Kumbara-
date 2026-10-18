import { describe, expect, it } from "vitest";
import { decideRoute, safeNextPath, scopeFor } from "./access";

const user = { userId: "u1", role: "USER" as const };
const admin = { userId: "a1", role: "ADMIN" as const };

describe("decideRoute", () => {
  it("lets anyone open the landing and login pages", () => {
    expect(decideRoute("/", null)).toEqual({ kind: "allow" });
    expect(decideRoute("/login", null)).toEqual({ kind: "allow" });
  });

  it("sends logged-out visitors to /login and remembers where they were going", () => {
    expect(decideRoute("/dashboard", null)).toEqual({ kind: "redirect", to: "/login?next=%2Fdashboard" });
    expect(decideRoute("/admin/users", null)).toEqual({
      kind: "redirect",
      to: "/login?next=%2Fadmin%2Fusers",
    });
  });

  it("keeps regular users out of /admin", () => {
    expect(decideRoute("/admin", user)).toEqual({ kind: "redirect", to: "/dashboard" });
    expect(decideRoute("/admin/users", user)).toEqual({ kind: "redirect", to: "/dashboard" });
    expect(decideRoute("/administrator", user)).toEqual({ kind: "allow" });
  });

  it("lets admins into /admin", () => {
    expect(decideRoute("/admin", admin)).toEqual({ kind: "allow" });
  });

  it("skips the login page for people already logged in", () => {
    expect(decideRoute("/login", user)).toEqual({ kind: "redirect", to: "/dashboard" });
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/dashboard?tab=1")).toBe("/dashboard?tab=1");
  });

  it("refuses anything that could leave the site or loop back to login", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", "/login", null]) {
      expect(safeNextPath(bad)).toBe("/dashboard");
    }
  });
});

describe("scopeFor", () => {
  it("limits a regular user to their own records", () => {
    expect(scopeFor({ id: "u1", role: "USER" })).toEqual({
      accounts: { ownerId: "u1" },
      transactions: { createdById: "u1" },
      receipts: { transaction: { createdById: "u1" } },
    });
  });

  it("gives an admin no filters", () => {
    expect(scopeFor({ id: "a1", role: "ADMIN" })).toEqual({ accounts: {}, transactions: {}, receipts: {} });
  });
});
