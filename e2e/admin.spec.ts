import { expect, test } from "@playwright/test";
import { logIn } from "./helpers";
import { ADMIN, SAVER } from "./users";

test("a regular user is kept out of the Admin area", async ({ page }) => {
  await logIn(page, SAVER);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/);
  const csv = await page.request.get("/admin/export/csv", { maxRedirects: 0 });
  expect(csv.status()).not.toBe(200);
});

test("the Admin sees everyone, the audit log and the export", async ({ page }) => {
  await logIn(page, ADMIN);
  await page.getByRole("link", { name: "Admin" }).first().click();
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();

  await page.goto("/admin/users");
  await expect(page.getByText(SAVER.email)).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Login" }).first()).toBeVisible();

  const csv = await page.request.get(`/admin/export/csv?currency=${process.env.HOME_CURRENCY || "TRY"}`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
});
