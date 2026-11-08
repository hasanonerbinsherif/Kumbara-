import { expect, test } from "@playwright/test";
import { logIn, PNG } from "./helpers";
import { SAVER } from "./users";

// Same currency as the dashboard, so the piggy fills without needing exchange rates.
const HOME = process.env.HOME_CURRENCY || "TRY";

test("logging money in, adding a receipt and watching the piggy fill", async ({ page, browser }) => {
  await logIn(page, SAVER);

  await page.goto("/accounts");
  await page.getByLabel("Name").fill("E2E piggy");
  await page.getByLabel("Currency").fill(HOME);
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("E2E piggy").first()).toBeVisible();

  await page.goto("/transactions/new");
  await page.getByLabel("Money in").check();
  await page.getByLabel("Amount").fill("250");
  await page.getByLabel("Currency").fill(HOME);
  await page.getByLabel("Who sent it?").fill("Grandma");
  await page.getByLabel("To account").selectOption({ label: `E2E piggy (${HOME})` });
  await page.getByLabel("How was it sent?").selectOption({ label: "Cash" });
  await page.getByRole("button", { name: "Save transaction" }).click();

  await expect(page).toHaveURL(/\/transactions\/\w+\?added=1/);
  await expect(page.getByRole("status")).toContainText("Into the piggy bank!");
  await expect(page.getByText("Grandma sent")).toBeVisible();

  await page.getByLabel("Add a receipt").setInputFiles({ name: "grandma.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("img", { name: "grandma.png" })).toBeVisible();
  const download = page.getByRole("link", { name: "Download" });
  const href = (await download.getAttribute("href"))!;
  const res = await page.request.get(href);
  expect(res.status()).toBe(200);
  expect(Buffer.from(await res.body()).equals(PNG)).toBe(true);

  // Without a login the receipt stays private.
  const stranger = await browser.newContext();
  expect((await stranger.request.get(href, { maxRedirects: 0 })).status()).not.toBe(200);
  await stranger.close();

  // Reloading the page doesn't drop the coins again.
  await page.goto(page.url().replace("?added=1", ""));
  await expect(page.getByText("Into the piggy bank!")).toHaveCount(0);

  await page.goto("/dashboard");
  await expect(page.getByText("You've kept 100% of the")).toBeVisible();
  await expect(page.getByRole("img", { name: "Piggy bank 100% full" })).toBeVisible();
});
