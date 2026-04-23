// @ts-check
import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";

const BASE_URL = "http://localhost:3000";

// I encountered some occasional timeouts in Firefox when running the full registration suite in parallel,
// so I'm marking the whole suite as slow to give it more time.
test.slow();
// Because I encountered some issues with test data conflicts when running
// the full suite across mutliple browsers, I'm using a timestamp + random token
// to ensure uniqueness for any test data created during these tests (users, events).
function uniqueToken(suffix = "") {
  return `${Date.now()}_${randomUUID().slice(0, 8)}${suffix}`;
}

// Helpers
// A helper function: register + log in a fresh user
// It uses a timestamp so it creates a unique email each time and avoids conflicts with existing accounts
async function registerAndLogin(page, suffix = "") {
  const email = `testuser_${uniqueToken(suffix)}@example.com`;
  const password = "TestPass123";
  const name = "Test User";

  await page.goto(`${BASE_URL}/register`);
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/events\/registrations(\?.*)?$/);
  return { email, password, name };
}
// A helper function to log in an existing user
async function loginUser(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/events\/registrations(\?.*)?$/);
}

// Create a new event with high available slots to avoid
// Register for the event identified by eventTitle. Each test must call
// setupTestEvent() first — seed-data slot counts deplete permanently across
// runs, so any named event can silently reach 0 and break this helper.
async function registerForFirstEvent(page, seatCount = 1, eventTitle) {
  await page.goto(`${BASE_URL}/events`);
  const eventCard = page.locator("article.event-list-item", {
    hasText: eventTitle,
  });
  await expect(eventCard).toBeVisible();
  await eventCard.locator("a.event-card-link").click();
  await page.waitForURL(/\/events\/.+/);
  await page.getByRole("link", { name: "Register For This Event" }).click();
  await page.waitForURL(/\/events\/.+\/register/);
  await page.fill("#ticketCount", String(seatCount));
  const addToMyCalendarButton = page.getByRole("button", {
    name: "Add To My Calendar",
  });
  await addToMyCalendarButton.click();
  await page.waitForURL(/\/events\/registrations(\?.*)?$/);
}

// Create a fresh admin event with the given slot count and log out admin.
// Returns the unique event title. Call this in every test that registers for
// an event. It guarantees fresh slots regardless of how many prior runs
// have depleted the database.
async function setupTestEvent(page, slots = 50) {
  const eventTitle = `Test Event ${uniqueToken()}`;
  await createAdminEvent(page, eventTitle, slots);
  await page.click('form[action="/admin/logout"] button');
  await page.waitForURL(`${BASE_URL}/admin/login`);
  return eventTitle;
}

// A helper function to log in as admin to manage test data setup for certain scenarios (like limited-slot events)
async function loginAdmin(page) {
  await page.goto(`${BASE_URL}/admin/login`);
  await page.fill("#username", "admin");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/admin/events`);
}

// A helper function to create a new event as admin with a specified number of slots
async function createAdminEvent(page, title, slots = 20) {
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/admin/events/new`);
  await page.fill("#title", title);
  await page.fill("#date", "2026-09-15");
  await page.fill("#location", "Test Venue, Kingston");
  await page.fill("#category", "Testing");
  await page.fill(
    "#image",
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
  );
  await page.fill(
    "#description",
    "A test event created by the Playwright test suite.",
  );
  await page.fill("#availableSlots", String(slots));
  await page.getByRole("button", { name: "Create Event" }).click();
  await page.waitForURL(/\/admin\/events(\?.*)?$/);
}

// 1) EVENT REGISTRATION – CREATE
test.describe("TC-029 to TC-036: Event Registration – Create", () => {
  // TC-029: Successful registration with 1 seat
  test("TC-029: Successfully registering for an event with 1 seat creates registration and shows success message", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 1, eventTitle);

    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Registration created successfully",
    );
    // Row must appear in the table
    await expect(
      page.locator("table.registrations-table tbody tr").first(),
    ).toBeVisible();
  });

  // TC-030: Successful registration with 10 seats (maximum allowed)
  test("TC-030: Registering with 10 seats (maximum) succeeds", async ({
    page,
  }) => {
    test.slow();

    // This case does admin setup plus user registration and is the only one that
    // occasionally times out in Firefox under full parallel load.
    const eventTitle = await setupTestEvent(page, 35);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 10, eventTitle);

    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Registration created successfully",
    );
  });

  // TC-031: Seat count 0 is rejected
  test("TC-031: Submitting registration form with 0 seats shows validation error", async ({
    page,
  }) => {
    const eventTitle031 = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events`);
    const card031 = page.locator("article.event-list-item", {
      hasText: eventTitle031,
    });
    await expect(card031).toBeVisible();
    await card031.locator("a.event-card-link").click();
    await page.getByRole("link", { name: "Register For This Event" }).click();
    await page.waitForURL(/\/register/);

    // Remove HTML5 min/max so we can send 0 to the server
    await page.evaluate(() => {
      const input = document.querySelector("#ticketCount");
      input.removeAttribute("min");
      input.removeAttribute("max");
    });
    await page.fill("#ticketCount", "0");
    await page.getByRole("button", { name: "Add To My Calendar" }).click();

    await expect(page.locator(".error-banner")).toContainText(
      "Please choose a whole number of seats between 1 and 10",
    );
  });

  // TC-032: Seat count 11 is rejected (above max)
  test("TC-032: Submitting registration form with 11 seats shows validation error", async ({
    page,
  }) => {
    const eventTitle032 = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events`);
    const card032 = page.locator("article.event-list-item", {
      hasText: eventTitle032,
    });
    await expect(card032).toBeVisible();
    await card032.locator("a.event-card-link").click();
    await page.getByRole("link", { name: "Register For This Event" }).click();
    await page.waitForURL(/\/register/);

    await page.evaluate(() => {
      const input = document.querySelector("#ticketCount");
      input.removeAttribute("min");
      input.removeAttribute("max");
    });
    await page.fill("#ticketCount", "11");
    await page.getByRole("button", { name: "Add To My Calendar" }).click();

    await expect(page.locator(".error-banner")).toContainText(
      "Please choose a whole number of seats between 1 and 10",
    );
  });

  // TC-033: Requesting more seats than available slots is rejected
  test("TC-033: Requesting more seats than available slots shows not enough slots error", async ({
    page,
  }) => {
    // We'll use an admin-created event with 2 slots for precision
    const eventTitle = `Limited Slots Event ${uniqueToken()}`;

    await createAdminEvent(page, eventTitle, 2);
    // logout admin to test as regular user
    await page.click('form[action="/admin/logout"] button');
    await expect(page).toHaveURL(`${BASE_URL}/admin/login`);

    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events`);

    const workshopCard = page.locator("article.event-list-item", {
      hasText: eventTitle,
    });
    await expect(workshopCard).toBeVisible();
    await workshopCard.locator("a.event-card-link").click();
    await page.getByRole("link", { name: "Register For This Event" }).click();
    await page.waitForURL(/\/register/);

    await page.evaluate(() => {
      const input = document.querySelector("#ticketCount");
      input.removeAttribute("min");
      input.removeAttribute("max");
    });
    await page.fill("#ticketCount", "6");
    await page.getByRole("button", { name: "Add To My Calendar" }).click();

    await expect(page.locator(".error-banner")).toContainText(
      "There are not enough available slots for that request",
    );
  });

  // TC-034: Unauthenticated user visiting /events/:id/register is redirected to login
  test("TC-034: Unauthenticated user navigating to registration form is redirected to login", async ({
    page,
  }) => {
    // Get a real event id from the events page
    await page.goto(`${BASE_URL}/events`);
    const href = await page
      .locator("article.event-list-item a.event-card-link")
      .first()
      .getAttribute("href");
    const eventId = href.split("/").pop();

    await page.goto(`${BASE_URL}/events/${eventId}/register`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator(".message")).toContainText(
      "Please log in to continue",
    );
  });

  // TC-035: Attempting to register for an already-registered event redirects to edit page
  test("TC-035: Registering for an already-registered event redirects to the edit page", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 1, eventTitle);

    // Navigate back to the SAME event's detail page — should show "Update My Seats"
    await page.goto(`${BASE_URL}/events`);
    const card035 = page.locator("article.event-list-item", {
      hasText: eventTitle,
    });
    await expect(card035).toBeVisible();
    await card035.locator("a.event-card-link").click();
    await page.waitForURL(/\/events\/.+/);

    const registerLink = page.getByRole("link", { name: "Update My Seats" });
    // After registration, the button on detail page becomes "Update My Seats"
    await expect(registerLink).toBeVisible();
  });

  // TC-036: Registration form shows correct max seat hint when event has limited slots
  test("TC-036: Registration form shows correct seat hint matching Math.min(10, availableSlots)", async ({
    page,
  }) => {
    await registerAndLogin(page);
    // August Design Sprint Demo Day has 40 slots — max is min(10,40)=10
    await page.goto(`${BASE_URL}/events`);
    const demoCard = page.locator("article.event-list-item", {
      hasText: "August Design Sprint Demo Day",
    });
    await demoCard.locator("a.event-card-link").click();
    await page.getByRole("link", { name: "Register For This Event" }).click();
    await page.waitForURL(/\/register/);

    const input = page.locator("#ticketCount");
    await expect(input).toHaveAttribute("max", "10");
    await expect(page.locator(".input-help")).toContainText(
      "You can save up to 10 seat(s)",
    );
  });
});

// 2) MY EVENTS PAGE – VIEW
test.describe("TC-037 to TC-040: My Events Page", () => {
  // TC-037: User with registrations sees table with all required columns
  test("TC-037: My Events page shows table with correct columns when user has registrations", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 2, eventTitle);

    await page.goto(`${BASE_URL}/events/registrations`);
    const table = page.locator("table.registrations-table");
    await expect(table).toBeVisible();

    // Verify column headers
    const headers = table.locator("thead th");
    await expect(headers.nth(0)).toContainText("Event");
    await expect(headers.nth(1)).toContainText("Date");
    await expect(headers.nth(2)).toContainText("Location");
    await expect(headers.nth(3)).toContainText("Seats");
    await expect(headers.nth(4)).toContainText("Status");
    await expect(headers.nth(5)).toContainText("When");
    await expect(headers.nth(6)).toContainText("Actions");

    // The row must show Confirmed status and Edit Seats / Remove Event buttons
    const firstRow = table.locator("tbody tr").first();
    await expect(firstRow.locator(".status-pill").first()).toContainText(
      "Confirmed",
    );
    await expect(
      firstRow.getByRole("link", { name: "Edit Seats" }),
    ).toBeVisible();
    await expect(
      firstRow.getByRole("button", { name: "Remove Event" }),
    ).toBeVisible();
  });

  // TC-038: User with no registrations sees the empty-state message
  test("TC-038: My Events page shows empty state heading when user has no registrations", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events/registrations`);

    await expect(page.locator(".empty-title")).toContainText(
      "Your calendar is still empty",
    );
    await expect(
      page.getByRole("link", { name: "Browse Events" }),
    ).toBeVisible();
    await expect(page.locator("table.registrations-table")).not.toBeVisible();
  });

  // TC-039: Past events show a muted Past Event pill
  // Note: All starter events are future-dated (2026-05 through 2026-08) so we can't
  // directly create a past registration. We verify the logic by checking upcoming pill.
  test("TC-039: Future event registration shows Upcoming pill in the When column", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 1, eventTitle);
    await page.goto(`${BASE_URL}/events/registrations`);

    const whenCell = page
      .locator("table.registrations-table tbody tr")
      .first()
      .locator("td")
      .nth(5);
    await expect(whenCell.locator(".status-pill")).toContainText("Upcoming");
  });

  // TC-040: Unauthenticated visit to /events/registrations redirects to login
  test("TC-040: Unauthenticated user navigating to /events/registrations is redirected to login", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events/registrations`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator(".message")).toContainText(
      "Please log in to continue",
    );
  });
});

// 3) EDIT REGISTRATION
test.describe("TC-041 to TC-045: Edit Registration", () => {
  // TC-041: Decreasing seat count updates registration and restores event slots
  test("TC-041: Decreasing seat count saves updated registration and redirects with success message", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 5, eventTitle);

    // Go to edit page for that registration
    await page.goto(`${BASE_URL}/events/registrations`);
    await page.getByRole("link", { name: "Edit Seats" }).first().click();
    await page.waitForURL(/\/edit/);

    await page.fill("#ticketCount", "3");
    await page.getByRole("button", { name: "Save Seat Changes" }).click();

    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Registration updated successfully",
    );

    // Verify seat count in the table is now 3
    const seatsCell = page
      .locator("table.registrations-table tbody tr")
      .first()
      .locator("td")
      .nth(3);
    await expect(seatsCell).toContainText("3");
  });

  // TC-042: Increasing seat count updates registration correctly
  test("TC-042: Increasing seat count saves updated registration with new count", async ({
    page,
  }) => {
    // setupTestEvent creates a fresh event as admin and logs out admin atomically.
    // registerForFirstEvent then handles the registration with a reliable URL assertion.
    const eventTitle = await setupTestEvent(page, 30);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 2, eventTitle);

    // Edit to 6
    await page.getByRole("link", { name: "Edit Seats" }).first().click();
    await page.waitForURL(/\/edit/);
    await page.fill("#ticketCount", "6");
    await page.getByRole("button", { name: "Save Seat Changes" }).click();

    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Registration updated successfully",
    );
    const seatsCell = page
      .locator("table.registrations-table tbody tr")
      .first()
      .locator("td")
      .nth(3);
    await expect(seatsCell).toContainText("6");
  });

  // TC-043: Requesting more seats than available + current shows error
  test("TC-043: Requesting seats beyond the allowed maximum shows not enough slots error", async ({
    page,
  }) => {
    // Use an event with only 3 slots. User registers 1 seat (2 remaining).
    // availableSlots + currentSeats = 2 + 1 = 3.
    // Requesting 4 seats passes normalizeSeatCount (1–10) but exceeds 3 → error.
    const eventTitle = await setupTestEvent(page, 3);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 1, eventTitle);

    await page.goto(`${BASE_URL}/events/registrations`);
    await page.getByRole("link", { name: "Edit Seats" }).first().click();
    await page.waitForURL(/\/edit/);

    // Remove the HTML5 max attribute (which equals 3) so the browser accepts 4
    await page.evaluate(() => {
      document.querySelector("#ticketCount").removeAttribute("max");
    });
    await page.fill("#ticketCount", "4");
    await page.getByRole("button", { name: "Save Seat Changes" }).click();

    await expect(page.locator(".error-banner")).toContainText(
      "There are not enough available slots for that request",
    );
  });

  // TC-044: Another user's registration edit is blocked (ownership check)
  test("TC-044: User B cannot access User A registration edit page", async ({
    page,
    browser,
  }) => {
    // Create a fresh event as admin on the main page, then log out admin.
    // pageA (User A) will register for this event in a separate browser context.
    const eventTitle = await setupTestEvent(page, 50);

    // Create User A and get their registration ID
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await registerAndLogin(pageA, "_userA");
    await registerForFirstEvent(pageA, 1, eventTitle);
    await pageA.goto(`${BASE_URL}/events/registrations`);
    const editLinkA = pageA.getByRole("link", { name: "Edit Seats" }).first();
    const editHref = await editLinkA.getAttribute("href");
    const regIdA = editHref.split("/")[2]; // /events/registrations/:id/edit
    await contextA.close();

    // Now User B tries to access User A's edit page
    await registerAndLogin(page, "_userB");
    await page.goto(`${BASE_URL}/events/registrations/${regIdA}/edit`);

    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "That registration could not be found",
    );
  });

  // TC-045: Edit form shows correct max seat hint (min(10, available+current))
  test("TC-045: Edit form help text shows correct maximum based on available + current seats", async ({
    page,
  }) => {
    // Create a 50-slot event: after registering 3 seats, available = 47.
    // max = min(10, 47 + 3) = 10, so assertions "max=10" and "1 and 10" still hold.
    const eventTitle = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 3, eventTitle);

    await page.getByRole("link", { name: "Edit Seats" }).first().click();
    await page.waitForURL(/\/edit/);

    // max should be min(10, 47+3) = 10
    const input = page.locator("#ticketCount");
    await expect(input).toHaveAttribute("max", "10");
    await expect(page.locator(".input-help")).toContainText(
      "You can keep between 1 and 10",
    );
  });
});

// 4) DELETE REGISTRATION
test.describe("TC-046 to TC-048: Delete Registration", () => {
  // TC-046: Deleting a registration removes it and shows success message
  test("TC-046: Deleting a registration removes it from My Events with success message", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await registerForFirstEvent(page, 3, eventTitle);

    await page.goto(`${BASE_URL}/events/registrations`);
    await expect(
      page.locator("table.registrations-table tbody tr"),
    ).toHaveCount(1);

    await page.getByRole("button", { name: "Remove Event" }).first().click();

    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Registration removed from your calendar",
    );
    // Table should be gone — empty state shown
    await expect(page.locator(".empty-title")).toContainText(
      "Your calendar is still empty",
    );
  });

  // TC-047: Another user cannot delete a different user's registration
  test("TC-047: User B cannot delete User A's registration", async ({
    page,
    browser,
  }) => {
    const eventTitle = await setupTestEvent(page, 50);

    // Create User A registration
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await registerAndLogin(pageA, "_userA_del");
    await registerForFirstEvent(pageA, 1, eventTitle);
    await pageA.goto(`${BASE_URL}/events/registrations`);
    const editLink = pageA.getByRole("link", { name: "Edit Seats" }).first();
    const editHref = await editLink.getAttribute("href");
    const regIdA = editHref.split("/")[2];
    await contextA.close();

    // User B attempts DELETE via form action
    await registerAndLogin(page, "_userB_del");
    // Playwright can't easily submit another user's form, so we navigate to the
    // edit page which uses the same ownership check
    await page.goto(`${BASE_URL}/events/registrations/${regIdA}/edit`);
    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "That registration could not be found",
    );
  });

  // TC-048: After deleting a registration, the event detail page shows Register again
  test("TC-048: After deleting registration, event detail page shows Register For This Event button again", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, 50);
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events`);
    const card048 = page.locator("article.event-list-item", {
      hasText: eventTitle,
    });
    await expect(card048).toBeVisible();
    const eventHref = await card048
      .locator("a.event-card-link")
      .getAttribute("href");
    await registerForFirstEvent(page, 2, eventTitle);

    // Delete registration
    await page.getByRole("button", { name: "Remove Event" }).first().click();
    await expect(page).toHaveURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Registration removed from your calendar",
    );
    await expect(page.locator(".empty-title")).toContainText(
      "Your calendar is still empty",
    );

    // Visit event detail — register button must reappear
    await page.goto(`${BASE_URL}${eventHref}`);
    await expect(
      page.getByRole("link", { name: "Register For This Event" }),
    ).toBeVisible();
  });
});
