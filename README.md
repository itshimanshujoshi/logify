# Logify

Convert your daily Slack work reports into formatted Excel timesheets — paste, edit, download.

---

## What it does

Your team posts daily work reports in Slack. Logify reads those messages, groups tasks by project, lets you edit everything inline, and generates a clean `.xlsx` timesheet ready to submit.

---

## Message Format

Each team member should post their daily report in this format:

```
Date : 2026-03-16
Project : LC
Task: [LC-252] Testing new feature
Start Time : 09:48 AM
End Time : 12:25 PM
Status : Done
```

### Fields

| Field | Required | Example |
|---|---|---|
| `Date` | Recommended | `2026-03-16` |
| `Project` | Yes | `LC`, `CanXida`, `PayrollMart` |
| `Task` | Yes | `[LC-252] Testing feature` |
| `Start Time` | Yes | `09:48 AM` |
| `End Time` | Yes | `12:25 PM` |
| `Status` | Optional | `Done`, `In Progress` |
| `Estimated Time` | Optional | `2h` |

---

## Date Detection

Logify automatically detects dates two ways:

### Option 1 — Add a `Date :` field (Recommended)

Include the date inside each message:

```
Date : 2026-03-16
Project : LC
Task: Testing
Start Time : 09:48 AM
End Time : 12:25 PM
```

### Option 2 — Use a separator line between days

Add a separator before each day's messages when pasting:

```
--- 2026-03-15 ---
Project : LC
Task: Task one
Start Time : 09:00 AM
End Time : 11:00 AM

--- 2026-03-16 ---
Project : LC
Task: Task two
Start Time : 10:00 AM
End Time : 01:00 PM
```

If no date is found, all tasks are assigned today's date. You can always edit the date directly in the table before downloading.

---

## How to Use

1. **Copy** your team's messages from Slack
2. **Paste** into the text area on Logify
3. Tasks are **automatically parsed** and grouped by project
4. **Edit** anything in the table — dates, task names, hours, headers
5. Click **Download** to get your `.xlsx` file

---

## Editing the Sheet

Everything in the preview table is editable before downloading:

- **Column headers** — click any header to rename it
- **Date** — click the date cell to change it
- **Task / Description** — click any cell to edit inline
- **Hours** — click to adjust
- **Add row** — add extra rows if needed
- **Delete row** — remove any row

---

## Multi-day Reports

Paste multiple days at once. As long as each message includes a `Date :` field (or separator lines between days), Logify will correctly group each task under the right date.

---

## Garbage Filtering

The following are automatically ignored — no manual cleanup needed:

- Conversation messages ("ok sir", "sure", "yes", etc.)
- Messages without `Project :`, `Task:`, `Start Time :`
- Lunch entries
- Short one-liners and reactions

---

## Tech Stack

- [Next.js 14](https://nextjs.org/) — App Router
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [ExcelJS](https://github.com/exceljs/exceljs) — Excel generation

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/itshimanshujoshi/logify.git
cd logify

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel (free)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Click Deploy — zero config needed, Vercel auto-detects Next.js

---

## Project Structure

```
src/
  app/
    page.tsx          # Main UI — paste, edit, download
    layout.tsx        # App layout and metadata
    globals.css       # Global styles
    api/
      generate/
        route.ts      # Excel generation API
  lib/
    parser.ts         # Parses Slack messages into structured tasks
public/
  assets/
    logo.png          # Logify logo
    favicon.ico       # Favicon
```

---

Made for internal team use.
