# Event Hub QA Case Study

## Note to Students

These assignments can be an individual or a group of two. If you are working with a partner, you can divide the work as you see fit. Please provide one submission per student or per pair, not one submission per person if you are working in a pair. Also, please name your partner in the submission if you are working in a pair.

## Overview

Event Hub is a server-rendered Node.js CRUD application that is being used as a
case study for two QUAL2000 Quality Assurance and Testing assignments. Students
will use this project as the system under test for:
Submission dates:

- Assignment 1: planning end-to-end test coverage and documenting that plan in
  [Test-Cases-Submission.xlsx](./Test-Cases-Submission.xlsx) while following
  the requirements in [Test Plan Assignment.docx](./Test%20Plan%20Assignment.docx)

- Assignment 1: Tuesday, April 15th at 11:59 PM

- Assignment 2: executing those planned scenarios with Playwright and completing
  the reporting expectations described in
  [QA Report-Assignment.docx](./QA%20Report-Assignment.docx)
- Assignment 2: Thursday, April 23rd at 11:59 PM

This README is written as the main student handout for using the app as a QA
case study. It explains how to run the app, configure the environment, load the
starter data, understand the app features, and map the project to both testing
assignments.

## Run The App

Use these steps first so the app is running before you begin planning or testing.

1. Install the npm packages:

```bash
npm install
```

2. Start the application with either of these commands:

```bash
npm start
```

or

```bash
node server.js
```

3. Open a browser to:

```text
http://localhost:3000
```

If the app loads successfully, you are ready to explore the site manually and
begin Assignment 1 or Assignment 2 work.

## Project Purpose In This Course

This repository is not just a sample CRUD app. It is the application students
will analyze, plan, and test from an end-user perspective. The goal is to help
students practice:

- identifying complete user workflows
- planning thorough end-to-end test coverage
- documenting expected behavior and test data
- executing automated E2E tests with Playwright
- recording pass/fail outcomes and bug information clearly

The emphasis is on testing the app as a realistic web application, not on
changing the application architecture.

## What Students Are Expected To Test

Students should treat the full Event Hub application as in scope for testing.
That includes both the public user experience and the admin dashboard.

### Public user workflows

- Home page access
- User registration
- User login and logout
- Viewing all available events
- Viewing a single event page
- Registering for an event
- Viewing the "My Events" page
- Editing seat counts for an existing registration
- Removing an event from a personal calendar
- Viewing the monthly calendar and agenda-style calendar page
- Handling negative scenarios such as invalid login, invalid seat count, or
  unavailable seats

### Admin workflows

- Admin login
- Viewing the admin events list
- Creating a new event
- Editing an existing event
- Deleting an event
- Verifying public-side changes after admin actions where relevant

### Environment and system-level checks

- Confirming the application runs locally on `http://localhost:3000`
- Confirming MongoDB Atlas connectivity works through the `.env` settings
- Confirming starter event data displays correctly after import
- Confirming public and admin flows work together across the same database

## Current Feature Summary

The current version of Event Hub includes:

- Public account creation and login
- Public event browsing and event detail pages
- Event registration for logged-in users
- Personal registration management
- Seat updates with a maximum of 10 seats per user per event
- Registration removal from a personal calendar
- Calendar views for saved events
- Admin login and event CRUD management
- Server-rendered EJS pages with MongoDB Atlas as the database

These features should guide the test plan students create in Assignment 1 and
the Playwright coverage they implement in Assignment 2.

## Prerequisites

Before working with the project, students should have:

- Node.js installed
- npm installed
- a MongoDB Atlas account
- access to MongoDB Compass or Atlas tools for importing JSON data
- a local clone or download of this repository
- a browser such as Chrome, Edge, or Firefox

For Assignment 2, students will also need Playwright installed in their own QA
workspace or project setup. This repository does not provide instructor-authored
Playwright tests.

## Environment Setup

The application requires a local `.env` file that matches the structure of
[.env.example](./.env.example).

### Step 1: Create a local environment file

Create a `.env` file in the project root and copy the same variable names from
`.env.example`.

Required variables:

```env
DB_URI=your_mongodb_atlas_connection_string
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_password_to_anything_you_want_with_no_spaces_or_special_characters
SESSION_SECRET=change_this_session_secret_to_anything_you_want_with_no_spaces_or_special_characters
```

### Step 2: Use your own MongoDB Atlas connection string

Students must use their own MongoDB Atlas connection string for `DB_URI`.

- Do not use another student's database
- Do not commit your `.env` file
- Do not share database credentials in screenshots, reports, or submissions

### Step 3: Keep `.env` local only

The `.env` file is for local development only and should remain uncommitted.
This repository already includes `.env.example` so students can see the required
variables without exposing secrets.

## Starter Event Data

A starter JSON file is provided to give students a consistent set of events to
test against:

- [data/starter-events.json](./data/starter-events.json)

The seed file follows the current `Event` schema exactly. Each record contains:

- `title`
- `date`
- `location`
- `category`
- `image`
- `description`
- `availableSlots`

No registration, user, admin, or extra metadata fields are included.

## Importing The Starter Data Into MongoDB Atlas

Students should load the starter events into their own MongoDB Atlas database
before testing.

### Recommended workflow with MongoDB Compass

1. Create your MongoDB Atlas cluster and obtain your connection string
2. Put that connection string in your local `.env` file as `DB_URI`
3. Open MongoDB Compass and connect to your Atlas cluster
4. Open the database used by your `DB_URI`
5. Create or open the `events` collection
6. Import [data/starter-events.json](./data/starter-events.json) into the
   `events` collection
7. Start the app and confirm the event data appears on the public site

### Important notes

- Import the JSON into the `events` collection
- Do not rename the fields in the JSON file
- Do not add extra fields before import
- If the events page is empty after import, verify the database name in your
  connection string and confirm the import was done in the correct collection

## Local Usage Flow Before Testing

Once your `.env` file and starter data are ready, the typical setup flow is:

1. Run `npm install`
2. Run `npm start` or `node server.js`
3. Open `http://localhost:3000`
4. Confirm the home page loads
5. Confirm the event directory shows the imported starter events
6. Create at least one public user account for testing
7. Use the admin credentials from your local `.env` file to verify the admin
   side is accessible

This creates a stable baseline before you begin planning or automating tests.

## Assignment 1: Test Plan

Assignment 1 asks students to prepare a complete end-to-end test plan for the
Event Hub website.

### Required files for Assignment 1

- [Test Plan Assignment.docx](./Test%20Plan%20Assignment.docx)
- [Test-Cases-Submission.xlsx](./Test-Cases-Submission.xlsx)

### What students should do

- Read the instructions in `Test Plan Assignment.docx`
- Explore the full Event Hub workflow manually
- Identify all major user stories, edge cases, and integration points
- Plan E2E scenarios for the full app, not only one page or one role
- Record the planned scenarios in `Test-Cases-Submission.xlsx`

### Spreadsheet columns in the provided template

The Excel file already includes columns for:

- `Test ID`
- `Test Steps`
- `Input Data`
- `Expected Result`
- `Actual Results`
- `Test Environment`
- `Execution Status (Pass/Fail)`
- `Bug Severity (Low/Medium/High)`
- `Bug Priority (Low/Medium/High)`
- `Notes`

### How to use the spreadsheet for Assignment 1

During the planning phase, students should:

- create a unique test ID for each planned case
- write clear step-by-step actions in `Test Steps`
- document needed credentials, field values, and setup details in `Input Data`
- define the expected system behavior in `Expected Result`
- note the target environment, such as local Event Hub with MongoDB Atlas, in
  `Test Environment`

Execution-oriented columns can stay blank or `N/A` until Assignment 2 if your
instructor allows that workflow.

### Coverage expectations for Assignment 1

A strong test plan should include:

- positive scenarios
- negative scenarios
- boundary conditions
- public user workflows
- admin workflows
- cross-page or multi-step workflows
- data-dependent behavior
- validation and error handling

Suggested coverage areas:

- app startup and environment validation
- home page and navigation
- user registration
- user login and logout
- event browsing
- single-event detail view
- registration creation
- seat update rules
- calendar views
- registration deletion
- admin login
- admin event create, edit, and delete
- invalid IDs, invalid form input, and full-capacity scenarios

## Assignment 2: QA Report And Playwright Execution

Assignment 2 uses the test plan from Assignment 1 as the basis for automated
execution with Playwright.

### Required file for Assignment 2

- [QA Report-Assignment.docx](./QA%20Report-Assignment.docx)

### What students should do

- review the completed test plan from Assignment 1
- translate planned scenarios into executable Playwright test scripts
- run those tests against the local Event Hub application
- update the spreadsheet with real execution results
- record failures, bug severity, bug priority, and notes where needed
- submit both the updated spreadsheet and the Playwright test source code

### Important reminder

This repository is the application under test. It is not a packaged Playwright
starter template. Students are responsible for creating their own Playwright
test implementation for Assignment 2.

### Recommended Playwright coverage

Students should automate the most important end-to-end flows, including:

- public user registration
- public login and logout
- browsing events
- opening event details
- creating a registration
- editing seat counts
- deleting a registration
- viewing calendar pages
- admin login
- creating an admin event
- editing an admin event
- deleting an admin event
- negative validation flows where practical

### Execution expectations

When students run Assignment 2, they should:

- execute against their local running app
- ensure the database contains the starter events
- use their own public test accounts
- use their local admin credentials from `.env`
- update the spreadsheet with actual results and pass/fail status

## Submission Guidance

### Assignment 1 submission (Tuesday, April 14th at 11:59 PM)

Students should submit the completed planning version of:

- `Test-Cases-Submission.xlsx`

### Assignment 2 submission (Thursday, April 23rd at 11:59 PM)

Students should submit:

- the updated `Test-Cases-Submission.xlsx` with execution results
- their Playwright source code or shared repository link for the test implementation

## Common Pitfalls

Students should watch for these common issues when preparing or executing tests:

- forgetting to create `.env`
- forgetting to use a personal MongoDB Atlas `DB_URI`
- importing starter data into the wrong database or collection
- starting the app before the database is ready
- writing tests for only the public side and ignoring admin flows
- documenting only happy paths and skipping validation or error cases
- leaving execution fields blank during Assignment 2
- sharing `.env` secrets or Atlas credentials

## Tech Stack

- Node.js
- Express
- Mongoose
- EJS
- dotenv
- express-session
- method-override
- MongoDB Atlas
- npm

## Project Structure

```text
.
|-- .env
|-- .env.example
|-- AGENTS.md
|-- QA Report-Assignment.docx
|-- README.md
|-- Test Plan Assignment.docx
|-- Test-Cases-Submission.xlsx
|-- data/
|   `-- starter-events.json
|-- models/
|-- public/
|-- server.js
|-- tests/
`-- views/
    `-- partials/
```

## Final Notes

Event Hub should be treated as a full QA case study for both assignments. The
application already contains enough public and admin functionality to support a
meaningful E2E test plan and a substantial Playwright execution phase. Students
should focus on quality, coverage, clarity, and realistic user behavior rather
than only producing a small number of test cases.
