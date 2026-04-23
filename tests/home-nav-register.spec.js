/*
// @ts-check
import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

// A helper function: register + log in a fresh user
// It uses a timestamp so it creates a unique email each time and avoids conflicts with existing accounts
async function registerAndLogin(page, suffix = "") {
  const ts = Date.now();
  const email = `testuser_${ts}${suffix}@example.com`;
  const password = "TestPass123";
  const name = "Test User";

  await page.goto(`${BASE_URL}/register`);
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/events/registrations**`);

  return { email, password, name };
}

// 1) HOME PAGE
test.describe("TC-001, TC-002, TC-003, TC-004, TC-005: Home Page", () => {
  // TC-001: Home page loads successfully
  test("TC-001: Home page loads with main section, heading, Browse Events button and nav", async ({
    page,
  }) => {
    await page.goto(BASE_URL);

    await expect(page.locator("h1.hero-title")).toContainText("Event Hub");
    await expect(
      page.getByRole("link", { name: "Browse Events" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create Your Account" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  // TC-002: Featured events section shows up to 3 cards with required fields
  test("TC-002: Featured events section displays up to 3 event cards with title, category, date, location, and slots", async ({
    page,
  }) => {
    await page.goto(BASE_URL);

    // The featured cards live inside the editorial section on the home page
    const cards = page.locator(".editorial-section .event-card-link");
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);

    // Verify the first card contains the expected detail elements
    const firstCard = cards.first();
    await expect(firstCard.locator(".event-title")).toBeVisible();
    await expect(firstCard.locator(".meta-pill").first()).toBeVisible(); // category
    await expect(firstCard.locator(".meta-pill").nth(1)).toBeVisible(); // date
    await expect(firstCard.locator(".meta-row")).toBeVisible(); // location + slots
  });

  // TC-003: Stats row shows correct fixed values (10, 2) and the featured count
  test("TC-003: Stats row shows featured event count, 10 for max seats, and 2 for calendar views", async ({
    page,
  }) => {
    await page.goto(BASE_URL);

    const statNumbers = page.locator(".stat-number");
    const texts = await statNumbers.allTextContents();

    // console.log("Stat texts:", texts); //

    //
    expect(texts[1]).toBe("10");
    expect(texts[2]).toBe("2");

    // First stat is the dynamic featured count — just check it's a number
    expect(Number(texts[0])).toBeGreaterThanOrEqual(0);
  });

  // TC-004: Clicking Browse Events in main section navigates to /events
  test("TC-004: Clicking Browse Events button navigates to the events listing page", async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await page.getByRole("link", { name: "Browse Events" }).first().click();
    await expect(page).toHaveURL(`${BASE_URL}/events`);
    await expect(page.locator("h1.page-title")).toContainText(
      "Explore the full Event Hub lineup",
    );
  });

  // TC-005: See All Events CTA at the bottom also goes to /events
  test("TC-005: See All Events Call to Action in the bottom section navigates to /events", async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await page.getByRole("link", { name: "See All Events" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/events`);
  });
});

// 2) NAVIGATION
test.describe("TC-006, TC-007, TC-008, TC-009: Navigation", () => {
  // TC-006: Logged-out nav shows Home, Events, Log In, Register and hides My Events, My Calendar, user pill
  test("TC-006: Logged-out navigation shows correct links and hides authenticated links", async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    const nav = page.getByRole("navigation");

    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Events" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Log In" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Register" })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "My Events" }),
    ).not.toBeVisible();
    await expect(
      nav.getByRole("link", { name: "My Calendar" }),
    ).not.toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Create Account" }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Admin Dashboard" }),
    ).toBeVisible();
  });

  // TC-007: Logged-in nav shows My Events, My Calendar, user pill and hides Home, Events, Log In, Register
  test("TC-007: Logged-in navigation shows My Events, My Calendar, user name pill", async ({
    page,
  }) => {
    const { name } = await registerAndLogin(page);
    const nav = page.getByRole("navigation");

    await expect(nav.getByRole("link", { name: "My Events" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "My Calendar" })).toBeVisible();
    await expect(nav.locator(".user-pill")).toContainText(name);
    await expect(nav.getByRole("link", { name: "Log In" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Register" })).not.toBeVisible();
  });

  // TC-008: Brand logo links back to home page
  test("TC-008: Clicking the Event Hub brand logo navigates back to the home page", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events`);
    await page.locator(".brand-name").first().click();
    await expect(page).toHaveURL(BASE_URL + "/");
    await expect(page.locator("h1.hero-title")).toContainText("Event Hub");
  });

  // TC-009: Events nav link has is-active class when on /events
  test("TC-009: Events nav link has is-active class when on the /events page", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events`);
    const eventsLink = page.locator("nav .nav-link", { hasText: "Events" });
    await expect(eventsLink).toHaveClass(/is-active/);

    // Home link must NOT be active
    const homeLink = page.locator("nav .nav-link", { hasText: "Home" });
    await expect(homeLink).not.toHaveClass(/is-active/);
  });
});

// 3) USER REGISTRATION
test.describe("TC-010, TC-011, TC-012, TC-013, TC-014: User Registration", () => {
  // TC-010: Successful registration redirects to My Events with success message
  test("TC-010: Successful registration creates account and redirects with success message", async ({
    page,
  }) => {
    const ts = Date.now();
    await page.goto(`${BASE_URL}/register`);
    await page.fill("#name", "Ahmad Tester");
    await page.fill("#email", `ahmad_tester_${ts}@example.com`);
    await page.fill("#password", "TestPass123");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Your account has been created successfully",
    );
    await expect(page.locator(".user-pill")).toBeVisible();
  });

  // TC-011: Duplicate email shows error banner
  test("TC-011: Registering with an already-used email shows duplicate email error", async ({
    page,
  }) => {
    // First registration
    const ts = Date.now();
    const email = `ahmad_dup_${ts}@example.com`;
    await page.goto(`${BASE_URL}/register`);
    await page.fill("#name", "Ahmad Tester");
    await page.fill("#email", email);
    await page.fill("#password", "TestPass123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/events\/registrations/);

    // Log out so we can try registering again with the same email
    const logoutButton = page.getByRole("button", { name: "Log Out" }); // Log out button
    await logoutButton.click(); // logout button
    await page.waitForURL(/\/login/);

    // Second registration attempt with same email
    await page.goto(`${BASE_URL}/register`);
    await page.fill("#name", "Ahmad Again");
    await page.fill("#email", email);
    await page.fill("#password", "AnyPass456");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/register`);
    await expect(page.locator(".error-banner")).toContainText(
      "An account already exists for that email address",
    );
  });

  // TC-012: All fields blank shows validation error
  test("TC-012: Submitting registration form with all fields blank shows error", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/register`);

    // bypass HTML5 required attribute and submit with empty values
    await page.evaluate(() => {
      document.querySelector("#name")?.removeAttribute("required");
      document.querySelector("#email")?.removeAttribute("required");
      document.querySelector("#password")?.removeAttribute("required");
    });
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/register`);
    await expect(page.locator(".error-banner")).toContainText(
      "Please complete every account field",
    );
  });

  // TC-013: Blank name field shows validation error
  test("TC-013: Submitting registration form with blank Name field shows error", async ({
    page,
  }) => {
    const ts = Date.now();
    await page.goto(`${BASE_URL}/register`);
    await page.evaluate(() => {
      document.querySelector("#name")?.removeAttribute("required");
    });
    await page.fill("#email", `partial_${ts}@example.com`);
    await page.fill("#password", "Pass123");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/register`);
    await expect(page.locator(".error-banner")).toContainText(
      "Please complete every account field",
    );
  });

  // TC-014: Logged-in user navigating to /register is redirected to My Events
  test("TC-014: Logged-in user navigating to /register is redirected to My Events", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/register`);
    await expect(page).toHaveURL(/\/events\/registrations/);
    // The register form heading must not be visible
    await expect(page.locator("h1.page-title")).not.toContainText(
      "Register before you start",
    );
  });
});
*/
