import { expect, test } from "@playwright/test";
import { logIn } from "./helpers";
import { SAVER } from "./users";

test("pages need a login", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login/);
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(SAVER.email);
  await page.getByRole("textbox", { name: "Password" }).fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("logging in and out", async ({ page }) => {
  await logIn(page, SAVER);
  await expect(page.getByRole("heading", { name: `Hi, ${SAVER.name}` })).toBeVisible();
  await expect(page.getByText("Log money coming in and watch the piggy fill up.")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
