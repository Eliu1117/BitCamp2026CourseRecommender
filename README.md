

# UMD Computer Science Course Recommender

**Turn a UMD degree audit into a prerequisite-aware course plan in seconds.**

[Next.js](https://nextjs.org/)
[React](https://react.dev/)
[TypeScript](https://www.typescriptlang.org/)
[Tailwind CSS](https://tailwindcss.com/)
[shadcn/ui](https://ui.shadcn.com/)
[Framer Motion](https://www.framer.com/motion/)
[Vitest](https://vitest.dev/)

[Live Demo](#) · [Report a Bug](https://github.com/Eliu1117/BitCamp2026CourseRecommender/issues) · [Features](#-features) · [Local Setup](#-local-setup)



---

Every semester, University of Maryland students dig through a wall of PDF-turned-HTML degree audits, cross-check dozens of prerequisite chains by hand, and refresh Testudo hoping a seat opens up. The **UMD Computer Science Course Recommender** kills that busywork: drop in your uAchieve degree audit and it parses your entire academic record client-side, figures out exactly which requirements you still owe, and ranks the courses that satisfy them — enriched with live seat counts, section times, professor GPA history, and PlanetTerp ratings. No login, no data leaving your browser, no more tab-juggling between four different UMD websites.

## Features

- **Custom DOM-based HTML parser** — `lib/parseAudit.ts` walks the raw uAchieve export in the browser (no server round-trip, no third-party upload) and turns it into a structured audit: completed courses, in-progress sections, unfulfilled requirement buckets, and Gen-Ed status.
- **Prerequisite-aware recommendations** — cross-references your completed coursework against prerequisite chains so you only ever see courses you're actually eligible to take next.
- **Real-time seat & section data** — pulls live section data from the JupiterP API so recommendations reflect open seats, meeting times, and instructors for the current term, not a stale catalog snapshot.
- **GPA & professor insight** — enriches every course and section with historical grade distributions and instructor ratings from PlanetTerp, fetched lazily and cached per card.
- **Drag-and-drop or paste** — upload an audit file directly or paste the raw HTML, with inline validation and toast-based error feedback for malformed input.
- **Polished, accessible UI** — built on `shadcn/ui` (Radix primitives) with keyboard-navigable dialogs, sheets, and tabs, animated with Framer Motion, and fully responsive down to mobile (a sticky sidebar becomes a swipe-up drawer for selected sections).
- **Light & dark mode** — theme-aware from the ground up via `next-themes`, with no flash-of-incorrect-theme on load.
- **Unit-tested core logic** — course-matching and requirement-resolution logic is covered by a Vitest suite (`lib/courses.test.ts`).

## Tech Stack


| Layer         | Choices                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Framework     | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/)                                            |
| Language      | [TypeScript](https://www.typescriptlang.org/)                                                                             |
| Styling       | [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)                        |
| Motion        | [Framer Motion](https://www.framer.com/motion/)                                                                           |
| Notifications | [Sonner](https://sonner.emilkowal.ski/)                                                                                   |
| Theming       | [next-themes](https://github.com/pacocoursey/next-themes)                                                                 |
| Testing       | [Vitest](https://vitest.dev/)                                                                                             |
| Data sources  | [umd.io](https://beta.umd.io/), JupiterP (live sections), [PlanetTerp](https://planetterp.com/) (GPA & professor ratings) |


## How It Works

1. **Upload** — you drag in (or paste) your uAchieve HTML degree audit on the homepage.
2. **Parse** — `lib/parseAudit.ts` walks the DOM entirely client-side and produces a typed `AuditResult`: courses completed, in-progress, and requirement buckets still outstanding.
3. **Match** — `lib/courses.ts` cross-references outstanding requirements against the UMD course catalog and filters out anything you don't yet have the prerequisites for.
4. **Enrich** — for each candidate course, the app fetches live section/seat data (JupiterP) and historical GPA/professor ratings (PlanetTerp) on demand.
5. **Recommend** — the `/courses` page renders ranked, filterable course cards; selecting sections builds a running plan in a responsive sidebar/drawer.

## Local Setup

**Prerequisites:** Node.js 20+ and npm.

```bash
# 1. Clone the repo
git clone https://github.com/Eliu1117/BitCamp2026CourseRecommender.git
cd BitCamp2026CourseRecommender

# 2. Install dependencies
npm install

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and drop in a UMD uAchieve degree audit to get started. No environment variables or API keys are required — every data source used (umd.io, JupiterP, PlanetTerp) is publicly accessible.

### Other scripts

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint (incl. React Compiler rules)
npm run test       # run the Vitest suite once
npm run test:watch # run Vitest in watch mode
```

## Project Structure

```
app/
  components/         # AuditUploader, CourseCard, CourseDetailPopup
  courses/            # /courses route — recommendation dashboard
  layout.tsx          # Root layout: theming, toasts, page transitions
  page.tsx            # Homepage: hero + audit uploader
components/
  ui/                 # shadcn/ui primitives (button, card, dialog, sheet, ...)
lib/
  parseAudit.ts       # HTML degree-audit parser
  courses.ts          # Prerequisite matching & recommendation logic
  api.ts              # umd.io / JupiterP / PlanetTerp API clients
  courses.test.ts     # Vitest unit tests for course-matching logic
```

