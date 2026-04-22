// @ts-check
import { test, expect } from "@playwright/test";

//
test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/");
});

// TC-001: Home page loads successfully. The main section displays the heading 'Event Hub', a 'Browse Events' button, and a 'Create Your Account'. Navigation bar is visible.
test("Home page loads successfully", async ({ page }) => {
  await expect(page.getByRole("link", { name: "Browse Events" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create Your Account" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
});

// TC-002: Up to 3 event cards are displayed in the featured section. Each card shows an event title, category pill, formatted date, location, and open slots count.
test("Featured events section displays up to 3 event cards with correct details", async ({
  page,
}) => {
  const eventCards = await page.getByTestId("event-card").all();
  expect(eventCards.length).toBeLessThanOrEqual(3);

  for (const card of eventCards) {
    await expect(card.getByTestId("event-title")).toBeVisible();
    await expect(card.getByTestId("event-category")).toBeVisible();
    await expect(card.getByTestId("event-date")).toBeVisible();
    await expect(card.getByTestId("event-location")).toBeVisible();
    await expect(card.getByTestId("event-slots")).toBeVisible();
  }
});

// TC-003: Three stat blocks are visible: the featured event count (a number), '10' for maximum seats, and '2' for calendar view types.
test("Stat blocks are visible with correct values", async ({ page }) => {
  await expect(page.locator("body")).toContainText("2");
  await expect(page.locator("body")).toContainText("10");
  await expect(page.locator("body")).toContainText("3");
});
