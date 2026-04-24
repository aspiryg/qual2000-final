// @ts-check
import { test, expect } from "@playwright/test";
// I used Node's built-in crypto module to generate unique tokens in addition to timestamps.
// This ensures uniqueness even if tests run very quickly, and avoids any issues with parallel
// test execution where multiple tests might share the same timestamp.
// The randomUUID function generates a random UUID string, and I slice it to keep the token
// shorter while still maintaining uniqueness.
import { randomUUID } from "crypto";

const BASE_URL = "http://localhost:3000";

test.slow();

function uniqueToken(suffix = "") {
  return `${Date.now()}_${randomUUID().slice(0, 8)}${suffix}`;
}

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

async function loginAdmin(page) {
  await page.goto(`${BASE_URL}/admin/login`);
  await page.fill("#username", "admin");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/admin/events`);
}

async function createAdminEvent(
  page,
  {
    title,
    date = "2026-09-15",
    location = "Test Venue, Kingston",
    category = "Testing",
    description = "A test event created by the Playwright test suite.",
    image = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    slots = 20,
  },
) {
  await loginAdmin(page);
  await page.goto(`${BASE_URL}/admin/events/new`);
  await page.fill("#title", title);
  await page.fill("#date", date);
  await page.fill("#location", location);
  await page.fill("#category", category);
  await page.fill("#image", image);
  await page.fill("#description", description);
  await page.fill("#availableSlots", String(slots));
  await page.getByRole("button", { name: "Create Event" }).click();
  await page.waitForURL(/\/admin\/events(\?.*)?$/);
}

async function setupTestEvent(page, options = {}) {
  const eventTitle = options.title || `Test Event ${uniqueToken()}`;
  await createAdminEvent(page, {
    title: eventTitle,
    date: options.date,
    location: options.location,
    category: options.category,
    description: options.description,
    image: options.image,
    slots: options.slots,
  });
  await page.click('form[action="/admin/logout"] button');
  await page.waitForURL(`${BASE_URL}/admin/login`);
  return eventTitle;
}

async function openEventByTitle(page, eventTitle) {
  await page.goto(`${BASE_URL}/events`);
  const eventCard = page.locator("article.event-list-item", {
    hasText: eventTitle,
  });
  await expect(eventCard).toBeVisible();
  await eventCard.locator("a.event-card-link").click();
  await page.waitForURL(/\/events\/.+/);
}

async function registerForEvent(page, eventTitle, seatCount = 1) {
  await openEventByTitle(page, eventTitle);
  await page.getByRole("link", { name: "Register For This Event" }).click();
  await page.waitForURL(/\/events\/.+\/register/);
  await page.fill("#ticketCount", String(seatCount));
  await page.getByRole("button", { name: "Add To My Calendar" }).click();
  await page.waitForURL(/\/events\/registrations(\?.*)?$/);
}

async function openAdminEditForEvent(page, eventTitle) {
  await page.goto(`${BASE_URL}/admin/events`);
  const row = page.locator("table.admin-table tbody tr", {
    hasText: eventTitle,
  });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Edit" }).click();
  await page.waitForURL(/\/admin\/events\/.+\/edit/);
}

async function getAvailableSlotsFromDetail(page) {
  const slotsItem = page.locator(".detail-list-item", {
    hasText: "Available Slots",
  });
  const text = await slotsItem.locator(".detail-value").textContent();
  return Number.parseInt(text || "0", 10);
}

// 5) CALENDAR - MONTHLY VIEW
test.describe("TC-049 to TC-053: Calendar - Monthly View", () => {
  test("TC-049: Calendar page loads showing current month heading and navigation buttons", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, {
      slots: 20,
      date: "2026-09-15",
    });
    await registerAndLogin(page);
    await registerForEvent(page, eventTitle, 1);
    await page.goto(`${BASE_URL}/events/registrations/calendar`);

    await expect(page.locator("h2.calendar-title")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Previous Month" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Current Month" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Next Month" })).toBeVisible();
    await expect(page.locator(".calendar-day").first()).toBeVisible();
  });

  test("TC-050: Clicking Previous Month updates the calendar heading and URL", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events/registrations/calendar?month=2026-04`);

    await page.getByRole("link", { name: "Previous Month" }).click();
    await expect(page).toHaveURL(/month=2026-03/);
    await expect(page.locator("h2.calendar-title")).toContainText("March 2026");
  });

  test("TC-051: Clicking Next Month updates the calendar heading and URL", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events/registrations/calendar?month=2026-04`);

    await page.getByRole("link", { name: "Next Month" }).click();
    await expect(page).toHaveURL(/month=2026-05/);
    await expect(page.locator("h2.calendar-title")).toContainText("May 2026");
  });

  test("TC-052: Registration appears in the correct calendar day cell", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, {
      date: "2026-06-02",
      slots: 20,
    });
    await registerAndLogin(page);
    await registerForEvent(page, eventTitle, 1);
    await page.goto(`${BASE_URL}/events/registrations/calendar?month=2026-06`);

    const june2Cell = page
      .locator("article.calendar-day")
      .filter({
        has: page.locator(".calendar-day-number", { hasText: "2" }),
      })
      .filter({ hasNot: page.locator(".is-outside-month") })
      .first();

    await expect(june2Cell.locator(".calendar-event-title")).toContainText(
      eventTitle,
    );
  });

  test("TC-053: Today's date cell has the is-today CSS class applied", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events/registrations/calendar`);

    await expect(page.locator("article.calendar-day.is-today")).toBeVisible();
  });
});

// 6) CALENDAR - AUTH GUARD
test.describe("TC-054: Calendar - Auth Guard", () => {
  test("TC-054: Unauthenticated user navigating to /events/registrations/calendar is redirected to login", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/events/registrations/calendar`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator(".message")).toContainText(
      "Please log in to continue",
    );
  });
});

// 7) CALENDAR - AGENDA VIEW
test.describe("TC-055 to TC-057: Calendar - Agenda View", () => {
  test("TC-055: Agenda section shows upcoming events in Upcoming column", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, {
      date: "2026-09-15",
      slots: 20,
    });
    await registerAndLogin(page);
    await registerForEvent(page, eventTitle, 1);
    await page.goto(`${BASE_URL}/events/registrations/calendar`);

    await page
      .locator("h3.agenda-title", { hasText: "Upcoming" })
      .scrollIntoViewIfNeeded();

    const upcomingColumn = page.locator(".agenda-column").first();
    await expect(upcomingColumn.locator(".agenda-card")).toHaveCount(1);
    await expect(upcomingColumn.locator(".subtle-link")).toContainText(
      eventTitle,
    );
  });

  test("TC-056: User with no registrations sees empty-state text in both agenda columns", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events/registrations/calendar`);

    await page
      .locator("h3.agenda-title", { hasText: "Upcoming" })
      .scrollIntoViewIfNeeded();
    await expect(
      page.locator(".empty-copy", {
        hasText: "No upcoming events have been saved yet.",
      }),
    ).toBeVisible();
    await expect(
      page.locator(".empty-copy", {
        hasText: "No past events are on your calendar yet.",
      }),
    ).toBeVisible();
  });

  test("TC-057: Clicking an agenda event title navigates to the event's public detail page", async ({
    page,
  }) => {
    const eventTitle = await setupTestEvent(page, {
      date: "2026-09-15",
      slots: 20,
    });
    await registerAndLogin(page);
    await registerForEvent(page, eventTitle, 1);
    await page.goto(`${BASE_URL}/events/registrations/calendar`);

    await page
      .locator("h3.agenda-title", { hasText: "Upcoming" })
      .scrollIntoViewIfNeeded();
    const agendaLink = page
      .locator(".agenda-column")
      .first()
      .locator(".subtle-link")
      .first();
    await agendaLink.click();

    await expect(page).toHaveURL(/\/events\/.+/);
    await expect(page.locator("h1.page-title")).toContainText(eventTitle);
  });
});

// 8) ADMIN LOGIN
test.describe("TC-058 to TC-062: Admin Login", () => {
  test("TC-058: Admin login with correct credentials redirects to /admin/events", async ({
    page,
  }) => {
    await loginAdmin(page);

    await expect(page).toHaveURL(`${BASE_URL}/admin/events`);
    await expect(page.locator("nav.admin-nav")).toBeVisible();
    await expect(page.locator("h1.admin-title")).toBeVisible();
  });

  test("TC-059: Admin login with wrong password shows error banner on /admin/login", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/admin/login`);
    await page.fill("#username", "admin");
    await page.fill("#password", "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/admin/login`);
    await expect(page.locator(".error-banner")).toContainText(
      "Incorrect username or password",
    );
  });

  test("TC-060: Admin login with wrong username shows error banner", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/admin/login`);
    await page.fill("#username", "notadmin");
    await page.fill("#password", "anything");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/admin/login`);
    await expect(page.locator(".error-banner")).toContainText(
      "Incorrect username or password",
    );
  });

  test("TC-061: Admin already logged in is redirected from /admin/login to /admin/events", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto(`${BASE_URL}/admin/login`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/events`);
  });

  test("TC-062: Admin logout redirects to /admin/login and clears the session", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.click('form[action="/admin/logout"] button');

    await expect(page).toHaveURL(`${BASE_URL}/admin/login`);
    await page.goto(`${BASE_URL}/admin/events`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/login`);
  });
});

// 9) ADMIN EVENTS LIST
test.describe("TC-063 to TC-064: Admin Events List", () => {
  test("TC-063: Admin events list shows all events with correct table columns", async ({
    page,
  }) => {
    await loginAdmin(page);

    const table = page.locator("table.admin-table");
    await expect(table).toBeVisible();

    const rows = table.locator("tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(8);

    const headers = table.locator("thead th");
    await expect(headers.nth(0)).toContainText("Title");
    await expect(headers.nth(1)).toContainText("Date");
    await expect(headers.nth(5)).toContainText("Actions");
    await expect(
      page.getByRole("link", { name: "Add New Event" }),
    ).toBeVisible();
  });

  test("TC-064: Unauthenticated access to /admin/events redirects to /admin/login", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/admin/events`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/login`);
  });
});

// 10) ADMIN CREATE EVENT
test.describe("TC-065 to TC-068: Admin Create Event", () => {
  test("TC-065: Admin can create a new event and it appears in the events table", async ({
    page,
  }) => {
    const title = `Playwright Test Event ${uniqueToken()}`;
    await createAdminEvent(page, { title, slots: 25 });

    await expect(page.locator(".message")).toContainText(
      "Event created successfully",
    );
    await expect(page.locator("table.admin-table")).toContainText(title);
  });

  test("TC-066: Creating event with blank Title shows error and form remains", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto(`${BASE_URL}/admin/events/new`);

    await page.evaluate(() => {
      document.querySelector("#title")?.removeAttribute("required");
    });
    await page.fill("#date", "2026-09-20");
    await page.fill("#location", "Some Venue");
    await page.fill("#category", "Test");
    await page.fill(
      "#image",
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    );
    await page.fill("#description", "A description.");
    await page.fill("#availableSlots", "10");
    await page.getByRole("button", { name: "Create Event" }).click();

    await expect(page.locator(".error-banner")).toContainText(
      "Please complete every event field correctly",
    );
  });

  test("TC-067: Creating event with negative Available Slots is rejected", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto(`${BASE_URL}/admin/events/new`);

    await page.evaluate(() => {
      document.querySelector("#availableSlots")?.removeAttribute("min");
    });
    await page.fill("#title", `Negative Slots ${uniqueToken()}`);
    await page.fill("#date", "2026-09-20");
    await page.fill("#location", "Some Venue");
    await page.fill("#category", "Test");
    await page.fill(
      "#image",
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
    );
    await page.fill("#description", "A description.");
    await page.fill("#availableSlots", "-5");
    await page.getByRole("button", { name: "Create Event" }).click();

    await expect(page.locator(".error-banner")).toContainText(
      "Please complete every event field correctly",
    );
  });

  test("TC-068: After creating an event, navigating to Add New Event shows blank form", async ({
    page,
  }) => {
    await createAdminEvent(page, {
      title: `Reset Test ${uniqueToken()}`,
      slots: 20,
    });

    await page.getByRole("link", { name: "Add New Event" }).click();
    await page.waitForURL(`${BASE_URL}/admin/events/new`);
    await expect(page.locator("#title")).toHaveValue("");
    await expect(page.locator("#location")).toHaveValue("");
    await expect(page.locator("#description")).toHaveValue("");
  });
});

// 11) ADMIN EDIT EVENT
test.describe("TC-069 to TC-073: Admin Edit Event", () => {
  test("TC-069: Edit form pre-populates all fields with the event's current values", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Edit Prefill ${uniqueToken()}`,
      slots: 12,
      location: "Prefill Venue",
      description: "Prefill description.",
    });
    await loginAdmin(page);
    await openAdminEditForEvent(page, title);

    await expect(page.locator("#title")).toHaveValue(title);
    await expect(page.locator("#location")).toHaveValue("Prefill Venue");
    await expect(page.locator("#description")).toContainText(
      "Prefill description.",
    );
    await expect(page.locator("#availableSlots")).toHaveValue("12");
  });

  test("TC-070: Admin can edit an event title and changes are saved", async ({
    page,
  }) => {
    const originalTitle = await setupTestEvent(page, {
      title: `Editable Event ${uniqueToken()}`,
      slots: 20,
    });
    const updatedTitle = `${originalTitle} Updated`;
    await loginAdmin(page);
    await openAdminEditForEvent(page, originalTitle);

    await page.fill("#title", updatedTitle);
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page).toHaveURL(/\/admin\/events/);
    await expect(page.locator(".message")).toContainText(
      "Event updated successfully",
    );
    await expect(page.locator("table.admin-table")).toContainText(updatedTitle);
  });

  test("TC-071: Clearing the Title on edit form shows validation error", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Clear Title ${uniqueToken()}`,
      slots: 10,
    });
    await loginAdmin(page);
    await openAdminEditForEvent(page, title);

    await page.evaluate(() => {
      document.querySelector("#title")?.removeAttribute("required");
    });
    await page.fill("#title", "");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.locator(".error-banner")).toContainText(
      "Please complete every event field correctly",
    );
  });

  test("TC-072: Setting Available Slots to 0 is valid and public page shows This event is full badge", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Full Event Test ${uniqueToken()}`,
      slots: 5,
    });
    await loginAdmin(page);
    await openAdminEditForEvent(page, title);
    await page.fill("#availableSlots", "0");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator(".message")).toContainText(
      "Event updated successfully",
    );

    await registerAndLogin(page, "_fullbadge");
    await openEventByTitle(page, title);
    await expect(page.locator(".status-pill-danger")).toContainText(
      "This event is full",
    );
  });

  test("TC-073: Navigating to edit page for non-existent event ID shows 404 page", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto(`${BASE_URL}/admin/events/000000000000000000000000/edit`);
    await expect(page.locator("h1.not-found-title")).toContainText(
      "That page is not part of Event Hub",
    );
  });
});

// 12) ADMIN DELETE EVENT
test.describe("TC-074 to TC-075: Admin Delete Event", () => {
  test("TC-074: Deleting an event removes it from the admin events table", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Delete Me ${uniqueToken()}`,
      slots: 10,
    });
    await loginAdmin(page);
    await page.goto(`${BASE_URL}/admin/events`);
    const targetRow = page.locator("table.admin-table tbody tr", {
      hasText: title,
    });
    await targetRow.locator("form button.button-danger").click();

    await expect(page).toHaveURL(/\/admin\/events/);
    await expect(page.locator(".message")).toContainText(
      "Event deleted successfully",
    );
    await expect(page.locator("table.admin-table")).not.toContainText(title);
  });

  test("TC-075: Deleting an event cascades to remove its registrations from user My Events", async ({
    page,
    browser,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Cascade Delete ${uniqueToken()}`,
      slots: 50,
    });
    await loginAdmin(page);
    await page.goto(`${BASE_URL}/admin/events`);
    await expect(page.locator("table.admin-table")).toContainText(title);

    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await registerAndLogin(userPage, "_cascade");
    await registerForEvent(userPage, title, 1);
    await expect(userPage.locator("table.registrations-table")).toContainText(
      title,
    );

    const targetRow = page.locator("table.admin-table tbody tr", {
      hasText: title,
    });
    await targetRow.locator("form button.button-danger").click();
    await page.waitForURL(/\/admin\/events/);
    await expect(page.locator(".message")).toContainText(
      "Event deleted successfully",
    );

    await userPage.goto(`${BASE_URL}/events/registrations`);
    await expect(userPage.locator("body")).not.toContainText(title);
    await userContext.close();
  });
});

// 13) INTEGRATION
test.describe("TC-076 to TC-082: Integration", () => {
  test("TC-076: Editing an event title in admin is immediately reflected on the public events page", async ({
    page,
  }) => {
    const originalTitle = await setupTestEvent(page, {
      title: `Reflect Test ${uniqueToken()}`,
      slots: 20,
    });
    const updatedTitle = `Reflected Update ${uniqueToken()}`;
    await loginAdmin(page);
    await openAdminEditForEvent(page, originalTitle);
    await page.fill("#title", updatedTitle);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForURL(/\/admin\/events/);

    await page.goto(`${BASE_URL}/events`);
    await expect(page.locator(".event-list")).toContainText(updatedTitle);
    await expect(page.locator(".event-list")).not.toContainText(originalTitle);
  });

  test("TC-077: Admin-created event appears on public /events listing with correct details", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Public Visible ${uniqueToken()}`,
      slots: 20,
    });
    await page.goto(`${BASE_URL}/events`);
    const card = page.locator("article.event-list-item", { hasText: title });
    await expect(card).toBeVisible();
    await card.locator("a.event-card-link").click();
    await page.waitForURL(/\/events\/.+/);
    const slotsItem = page.locator(".detail-list-item", {
      hasText: "Available Slots",
    });
    await expect(slotsItem.locator(".detail-value")).toContainText("20");
  });

  test("TC-078: Admin-deleted event no longer appears on the public /events listing", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Delete Public ${uniqueToken()}`,
      slots: 10,
    });
    await page.goto(`${BASE_URL}/events`);
    await expect(
      page.locator("article.event-list-item", { hasText: title }),
    ).toBeVisible();

    await loginAdmin(page);
    const row = page.locator("table.admin-table tbody tr", { hasText: title });
    await row.locator("form button.button-danger").click();
    await page.waitForURL(/\/admin\/events/);

    await page.goto(`${BASE_URL}/events`);
    await expect(page.locator(".event-list")).not.toContainText(title);
  });

  test("TC-079: Registering 3 seats decrements event available slots by 3", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Seat Delta ${uniqueToken()}`,
      slots: 30,
    });
    await registerAndLogin(page);
    await openEventByTitle(page, title);
    const initialSlots = await getAvailableSlotsFromDetail(page);
    await page.getByRole("link", { name: "Register For This Event" }).click();
    await page.waitForURL(/\/register/);
    await page.fill("#ticketCount", "3");
    await page.getByRole("button", { name: "Add To My Calendar" }).click();
    await page.waitForURL(/\/events\/registrations/);

    await openEventByTitle(page, title);
    const updatedSlots = await getAvailableSlotsFromDetail(page);
    expect(updatedSlots).toBe(initialSlots - 3);
  });

  test("TC-080: Editing registration from 3 to 5 seats further reduces available slots by 2", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Seat Edit ${uniqueToken()}`,
      slots: 30,
    });
    await registerAndLogin(page);
    await openEventByTitle(page, title);
    const slotsBefore = await getAvailableSlotsFromDetail(page);

    await page.getByRole("link", { name: "Register For This Event" }).click();
    await page.waitForURL(/\/register/);
    await page.fill("#ticketCount", "3");
    await page.getByRole("button", { name: "Add To My Calendar" }).click();
    await page.waitForURL(/\/events\/registrations/);

    await page.getByRole("link", { name: "Edit Seats" }).first().click();
    await page.waitForURL(/\/edit/);
    await page.fill("#ticketCount", "5");
    await page.getByRole("button", { name: "Save Seat Changes" }).click();
    await page.waitForURL(/\/events\/registrations/);

    await openEventByTitle(page, title);
    const slotsAfter = await getAvailableSlotsFromDetail(page);
    expect(slotsAfter).toBe(slotsBefore - 5);

    await page.goto(`${BASE_URL}/events/registrations`);
    const seatsCell = page
      .locator("table.registrations-table tbody tr")
      .first()
      .locator("td")
      .nth(3);
    await expect(seatsCell).toContainText("5");
  });

  test("TC-081: Deleting a registration with 2 seats restores those slots to the event", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Restore Slots ${uniqueToken()}`,
      slots: 30,
    });
    await registerAndLogin(page);
    await openEventByTitle(page, title);
    const slotsBefore = await getAvailableSlotsFromDetail(page);

    await page.getByRole("link", { name: "Register For This Event" }).click();
    await page.waitForURL(/\/register/);
    await page.fill("#ticketCount", "2");
    await page.getByRole("button", { name: "Add To My Calendar" }).click();
    await page.waitForURL(/\/events\/registrations/);

    await page.getByRole("button", { name: "Remove Event" }).first().click();
    await page.waitForURL(/\/events\/registrations/);

    await openEventByTitle(page, title);
    const slotsAfter = await getAvailableSlotsFromDetail(page);
    expect(slotsAfter).toBe(slotsBefore);

    await page.goto(`${BASE_URL}/events/registrations`);
    await expect(page.locator(".empty-title")).toContainText(
      "Your calendar is still empty",
    );
  });

  test("TC-082: Full user journey - register account, book event, edit seats, view calendar, delete registration", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Journey Event ${uniqueToken()}`,
      slots: 45,
      date: "2026-07-08",
    });

    const email = `e2e_${uniqueToken()}@example.com`;
    await page.goto(`${BASE_URL}/register`);
    await page.fill("#name", "E2E User");
    await page.fill("#email", email);
    await page.fill("#password", "TestPass123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Your account has been created successfully",
    );

    await registerForEvent(page, title, 1);
    await expect(page.locator(".message")).toContainText(
      "Registration created successfully",
    );
    await expect(
      page.locator("table.registrations-table tbody tr"),
    ).toHaveCount(1);

    await page.getByRole("link", { name: "Edit Seats" }).first().click();
    await page.waitForURL(/\/edit/);
    await page.fill("#ticketCount", "3");
    await page.getByRole("button", { name: "Save Seat Changes" }).click();
    await page.waitForURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Registration updated successfully",
    );
    const seatsCell = page
      .locator("table.registrations-table tbody tr")
      .first()
      .locator("td")
      .nth(3);
    await expect(seatsCell).toContainText("3");

    await page.goto(`${BASE_URL}/events/registrations/calendar`);
    await page
      .locator("h3.agenda-title", { hasText: "Upcoming" })
      .scrollIntoViewIfNeeded();
    await expect(
      page.locator(".agenda-column").first().locator(".subtle-link"),
    ).toContainText(title);

    await page.goto(`${BASE_URL}/events/registrations`);
    await page.getByRole("button", { name: "Remove Event" }).first().click();
    await page.waitForURL(/\/events\/registrations/);
    await expect(page.locator(".message")).toContainText(
      "Registration removed from your calendar",
    );
    await expect(page.locator(".empty-title")).toContainText(
      "Your calendar is still empty",
    );
  });
});

// 14) EDGE AND BOUNDARY CASES
test.describe("TC-083 to TC-088: Edge and Boundary Cases", () => {
  test("TC-083: Registering the last available seat causes event to show This event is full", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Last Seat ${uniqueToken()}`,
      slots: 1,
    });
    await registerAndLogin(page, "_lastseat");
    await openEventByTitle(page, title);
    const eventUrl = page.url();
    await page.getByRole("link", { name: "Register For This Event" }).click();
    await page.waitForURL(/\/register/);
    await page.fill("#ticketCount", "1");
    await page.getByRole("button", { name: "Add To My Calendar" }).click();
    await page.waitForURL(/\/events\/registrations/);

    await page.goto(eventUrl);
    const slotsAfter = await getAvailableSlotsFromDetail(page);
    expect(slotsAfter).toBe(0);
    await expect(
      page.getByRole("link", { name: "Update My Seats" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Register For This Event" }),
    ).not.toBeVisible();
  });

  test("TC-084: Saving the edit form with the same seat count does not change event slots", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Same Seats ${uniqueToken()}`,
      slots: 20,
    });
    await registerAndLogin(page);
    await openEventByTitle(page, title);
    const slotsBefore = await getAvailableSlotsFromDetail(page);

    await page.getByRole("link", { name: "Register For This Event" }).click();
    await page.waitForURL(/\/register/);
    await page.fill("#ticketCount", "10");
    await page.getByRole("button", { name: "Add To My Calendar" }).click();
    await page.waitForURL(/\/events\/registrations/);

    await page.getByRole("link", { name: "Edit Seats" }).first().click();
    await page.waitForURL(/\/edit/);
    await page.getByRole("button", { name: "Save Seat Changes" }).click();
    await page.waitForURL(/\/events\/registrations/);

    await openEventByTitle(page, title);
    const slotsAfter = await getAvailableSlotsFromDetail(page);
    expect(slotsAfter).toBe(slotsBefore - 10);
  });

  test("TC-085: Public user navigating to /admin/events is redirected to /admin/login", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/admin/events`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/login`);
  });

  test("TC-086: Admin nav View Public Site link navigates to /events", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.getByRole("link", { name: "View Public Site" }).click();
    await expect(page).toHaveURL(`${BASE_URL}/events`);
  });

  test("TC-087: Clicking Previous Month 3 times from April 2026 correctly shows January 2026", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto(`${BASE_URL}/events/registrations/calendar?month=2026-04`);

    await page.getByRole("link", { name: "Previous Month" }).click();
    await expect(page.locator("h2.calendar-title")).toContainText("March 2026");

    await page.getByRole("link", { name: "Previous Month" }).click();
    await expect(page.locator("h2.calendar-title")).toContainText(
      "February 2026",
    );

    await page.getByRole("link", { name: "Previous Month" }).click();
    await expect(page.locator("h2.calendar-title")).toContainText(
      "January 2026",
    );
  });

  test("TC-088: Clicking a calendar event block navigates to the registration edit page", async ({
    page,
  }) => {
    const title = await setupTestEvent(page, {
      title: `Calendar Block ${uniqueToken()}`,
      date: "2026-06-02",
      slots: 20,
    });
    await registerAndLogin(page);
    await registerForEvent(page, title, 1);
    await page.goto(`${BASE_URL}/events/registrations/calendar?month=2026-06`);

    const june2Cell = page
      .locator("article.calendar-day")
      .filter({
        has: page.locator(".calendar-day-number", { hasText: "2" }),
      })
      .filter({ hasNot: page.locator(".is-outside-month") })
      .first();

    await june2Cell.locator("a.calendar-event").click();
    await expect(page).toHaveURL(/\/events\/registrations\/.+\/edit/);
    await expect(page.locator("h1.page-title")).toContainText(
      "Adjust your seats",
    );
  });
});
