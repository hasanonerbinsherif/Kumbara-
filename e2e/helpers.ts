import { expect, type Page } from "@playwright/test";

export async function logIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(who.email);
  await page.getByRole("textbox", { name: "Password" }).fill(who.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** A tiny valid PNG (1×1, pink), enough for the receipt upload checks. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4/5+BAQAE/wH+u6GsNwAAAABJRU5ErkJggg==",
  "base64",
);
