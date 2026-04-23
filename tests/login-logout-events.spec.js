// @ts-check
import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

// Helpers
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

// A helper function to log in an existing user
async function loginUser(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/events/registrations**`);
}

// A helper function to log in as admin
async function loginAdmin(page) {
  await page.goto(`${BASE_URL}/admin/login`);
  await page.fill("#username", "admin");
  await page.fill("#password", "admin");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/admin/events`);
}

// USER LOGIN
test.describe("TC-015, TC-016, TC-017, TC-018, TC-019: User Login", () => {
  // TC-015: Successful login redirects to My Events with message
  test("TC-015: Successful login redirects to My Events with logged-in message", async ({
    page,
  }) => {
    // Create the account first
    const ts = Date.now();
    const email = `login_ok_${ts}@example.com`;
    await page.goto(`${BASE_URL}/register`);
    await page.fill("#name", "Login Test");
    await page.fill("#email", email);
    await page.fill("#password", "TestPass123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/events\/registrations/);

    // Log out
    await page.click('form[action="/logout"] button');
    await page.waitForURL(/\/login/);

    // log in
    await loginUser(page, email, "TestPass123");
    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "You are now logged in",
    );
    await expect(page.locator(".user-pill")).toBeVisible();
  });

  // TC-016: Wrong password shows error, email pre-filled
  test("TC-016: Login with correct email but wrong password shows error and pre-fills email", async ({
    page,
  }) => {
    // Create the account
    const ts = Date.now();
    const email = `login_bad_${ts}@example.com`;
    await page.goto(`${BASE_URL}/register`);
    await page.fill("#name", "Test");
    await page.fill("#email", email);
    await page.fill("#password", "RealPass123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/events\/registrations/);
    // Log out
    await page.click('form[action="/logout"] button');
    await page.waitForURL(/\/login/);

    // Attempt login with correct email but wrong password
    await page.fill("#email", email);
    await page.fill("#password", "WrongPassword");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/login`);
    await expect(page.locator(".error-banner")).toContainText(
      "Incorrect email address or password",
    );
    await expect(page.locator("#email")).toHaveValue(email); // Email is pre-filled with the attempted email
  });

  // TC-017: Non-existent email shows error
  test("TC-017: Login with non-existent email shows incorrect credentials error", async ({
    page,
  }) => {
    //
    await page.goto(`${BASE_URL}/login`);
    await page.fill("#email", "nobody@example.com");
    await page.fill("#password", "SomePass");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/login`);
    await expect(page.locator(".error-banner")).toContainText(
      "Incorrect email address or password",
    );
  });

  // TC-018: Blank fields
  test("TC-018: Submitting login form with blank fields is blocked", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    // Remove HTML5 required attributes so we can test server response
    await page.evaluate(() => {
      document.querySelector("#email")?.removeAttribute("required");
      document.querySelector("#password")?.removeAttribute("required");
    });
    await page.click('button[type="submit"]');

    // stays on /login with an error
    await expect(page).toHaveURL(`${BASE_URL}/login`);
    await expect(page.locator(".error-banner")).toContainText(
      "Incorrect email address or password.",
    );
  });

  // TC-019: Logged-in user navigating to /login is redirected to My Events
  test("TC-019: Logged-in user navigating to /login is redirected to My Events", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(/\/events\/registrations/);
  });
});

// USER LOGOUT
test.describe("TC-020 to TC-021: User Logout", () => {
  // TC-020: Logout clears session and redirects to login with message
  test("TC-020: Logging out clears session and redirects to /login with logged-out message and resets nav", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.click('form[action="/logout"] button');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator(".message")).toContainText(
      "You have been logged out",
    );
    // Nav should show Log In and Register again
    await expect(page.getByRole("link", { name: "Log In" })).toBeVisible();
  });

  // TC-021: After logout, /events/registrations is blocked
  test("TC-021: After logout, navigating to /events/registrations redirects to login", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.click('form[action="/logout"] button');
    await page.waitForURL(/\/login/);

    await page.goto(`${BASE_URL}/events/registrations`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator(".message")).toContainText(
      "Please log in to continue",
    );
  });
});

// EVENTS DIRECTORY
test.describe("TC-022 - TC-023: Events Directory", () => {
  // TC-022: All 8 starter events are displayed on /events
  test("TC-022: Events page displays all 8 starter events as cards with required fields", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events`);

    const cards = page.locator("article.event-list-item");
    await expect(cards).toHaveCount(8);

    // Verify the first card has the expected elements
    const first = cards.first();
    await expect(first.locator(".event-title")).toBeVisible();
    await expect(first.locator(".meta-pill").first()).toBeVisible(); // category
    await expect(first.locator(".meta-pill").nth(1)).toBeVisible(); // date
    await expect(first.locator(".meta-row")).toBeVisible(); // location + slots
  });

  // TC-023: Clicking Kingston Spring Music Festival card goes to its detail page
  test("TC-023: Clicking an event card navigates to that event's detail page", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events`);

    // Kingston Spring Music Festival is the first event (sorted by date)
    const firstCard = page.locator("article.event-list-item").first();
    const titleText = await firstCard.locator(".event-title").textContent();
    await firstCard.locator("a.event-card-link").click();

    await expect(page).toHaveURL(/\/events\/.+/);
    await expect(page.locator("h1.page-title")).toContainText(titleText.trim());
  });
});

// EVENT DETAIL PAGE
test.describe("TC-024 to TC-028: Event Detail Page", () => {
  // TC-024: Detail page renders all fields (image, category, date, description, location, slots)
  test("TC-024: Event detail page renders all required fields correctly", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events`);
    await page
      .locator("article.event-list-item a.event-card-link")
      .first()
      .click();
    await page.waitForURL(/\/events\/.+/);

    await expect(page.locator(".event-hero-media")).toBeVisible(); // hero image
    await expect(page.locator(".detail-meta .meta-pill").first()).toBeVisible(); // category
    await expect(page.locator(".detail-meta .meta-pill").nth(1)).toBeVisible(); // date
    await expect(page.locator(".detail-copy")).toBeVisible(); // description
    await expect(page.locator(".detail-list")).toBeVisible(); // location + date + slots
    await expect(
      page.getByRole("link", { name: "Back To Events" }),
    ).toBeVisible();
  });

  // TC-025: Unauthenticated user navigating to event detail sees Log In To Register and Create Account links, but not Register button
  test("TC-025: Unauthenticated user navigating to event detail sees Log In To Register and Create Account links, but not Register button", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events`);
    await page
      .locator("article.event-list-item a.event-card-link")
      .first()
      .click();

    await expect(
      page.getByRole("link", { name: "Log In To Register" }),
    ).toBeVisible();
    // with class "button-secondary" link "Create Account" should be visible // there
    await expect(
      page.locator("a.button-secondary", { hasText: "Create Account" }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "Register For This Event" }),
    ).not.toBeVisible();
  });

  // TC-026: Logged-in user on detail page for an event with slots and no registration
  // sees Register For This Event and View My Events
  test("TC-026: Logged-in user with no registration sees Register For This Event button", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events`);
    await page
      .locator("article.event-list-item a.event-card-link")
      .first()
      .click();

    await expect(
      page.getByRole("link", { name: "Register For This Event" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View My Events" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Log In To Register" }),
    ).not.toBeVisible();
  });

  // TC-027: Valid-format but non-existent ObjectId for an event returns 404 page
  test("TC-027: Navigating to a valid-format but non-existent event ID returns 404 page", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events/000000000000000000000000`);
    await expect(page.locator("h1.not-found-title")).toContainText(
      "That page is not part of Event Hub",
    );
    await expect(page.getByRole("link", { name: "Return Home" })).toBeVisible();
  });

  // TC-028: Malformed event ID returns 404 page
  test("TC-028: Navigating to a malformed event ID returns 404 page", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events/not-a-valid-id`);
    await expect(page.locator("h1.not-found-title")).toContainText(
      "That page is not part of Event Hub",
    );
  });
});
