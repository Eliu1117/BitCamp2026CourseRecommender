<div align="center">

# 🪐 Better Jupiterp

**Turn a UMD degree audit into a prerequisite-aware course plan in seconds.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-radix--nova-000000?logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-animations-0055FF?logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

[Live Demo](#) · [Report a Bug](https://github.com/Eliu1117/BitCamp2026CourseRecommender/issues) · [Features](#-features) · [Local Setup](#-local-setup)

</div>

---

## ✨ Elevator Pitch

Every semester, University of Maryland students dig through a wall of PDF-turned-HTML degree audits, cross-check dozens of prerequisite chains by hand, and refresh Testudo hoping a seat opens up. **Better Jupiterp** kills that busywork: drop in your uAchieve degree audit and it parses your entire academic record client-side, figures out exactly which requirements you still owe, and ranks the courses that satisfy them — enriched with live seat counts, section times, professor GPA history, and PlanetTerp ratings. No login, no data leaving your browser, no more tab-juggling between four different UMD websites.

## 📸 Screenshots

> Drop your own captures into `docs/screenshots/` using the filenames below and they'll render automatically here.

| Home & Upload | Course Recommendations |
| --- | --- |
| ![Homepage with drag-and-drop audit uploader](docs/screenshots/home.png) | ![Course cards with GPA, seats, and section data](docs/screenshots/courses.png) |

| Course Detail Dialog | Mobile / Responsive View |
| --- | --- |
| ![Course detail dialog with prerequisites and professor ratings](docs/screenshots/detail-dialog.png) | ![Responsive mobile layout with selected-sections drawer](docs/screenshots/mobile.png) |

## 🚀 Features

- **Custom DOM-based HTML parser** — `lib/parseAudit.ts` walks the raw uAchieve export in the browser (no server round-trip, no third-party upload) and turns it into a structured audit: completed courses, in-progress sections, unfulfilled requirement buckets, and Gen-Ed status.
- **Prerequisite-aware recommendations** — cross-references your completed coursework against prerequisite chains so you only ever see courses you're actually eligible to take next.
- **Real-time seat & section data** — pulls live section data from the JupiterP API so recommendations reflect open seats, meeting times, and instructors for the current term, not a stale catalog snapshot.
- **GPA & professor insight** — enriches every course and section with historical grade distributions and instructor ratings from PlanetTerp, fetched lazily and cached per card.
- **Drag-and-drop or paste** — upload an audit file directly or paste the raw HTML, with inline validation and toast-based error feedback for malformed input.
- **Polished, accessible UI** — built on `shadcn/ui` (Radix primitives) with keyboard-navigable dialogs, sheets, and tabs, animated with Framer Motion, and fully responsive down to mobile (a sticky sidebar becomes a swipe-up drawer for selected sections).
- **Light & dark mode** — theme-aware from the ground up via `next-themes`, with no flash-of-incorrect-theme on load.
- **Unit-tested core logic** — course-matching and requirement-resolution logic is covered by a Vitest suite (`lib/courses.test.ts`).

## 🧱 Tech Stack

| Layer | Choices |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) (Radix primitives) |
| Motion | [Framer Motion](https://www.framer.com/motion/) |
| Notifications | [Sonner](https://sonner.emilkowal.ski/) |
| Theming | [next-themes](https://github.com/pacocoursey/next-themes) |
| Testing | [Vitest](https://vitest.dev/) |
| Data sources | [umd.io](https://beta.umd.io/), JupiterP (live sections), [PlanetTerp](https://planetterp.com/) (GPA & professor ratings) |

## 🗺️ How It Works

1. **Upload** — you drag in (or paste) your uAchieve HTML degree audit on the homepage.
2. **Parse** — `lib/parseAudit.ts` walks the DOM entirely client-side and produces a typed `AuditResult`: courses completed, in-progress, and requirement buckets still outstanding.
3. **Match** — `lib/courses.ts` cross-references outstanding requirements against the UMD course catalog and filters out anything you don't yet have the prerequisites for.
4. **Enrich** — for each candidate course, the app fetches live section/seat data (JupiterP) and historical GPA/professor ratings (PlanetTerp) on demand.
5. **Recommend** — the `/courses` page renders ranked, filterable course cards; selecting sections builds a running plan in a responsive sidebar/drawer.

## 🏁 Local Setup

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

## 📁 Project Structure

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

## 🛣️ Roadmap

This project is being built out in phases; UI/UX polish is complete and the following are planned next:

- [ ] Replace hardcoded semester codes with a dynamic lookup against umd.io
- [ ] Move parsed-audit state out of `sessionStorage` and into a proper Context/Zustand store
- [ ] Next.js `error.tsx` boundaries around API-dependent routes
- [ ] Request caching / stale-while-revalidate for umd.io & JupiterP calls
- [ ] Expanded test coverage for `parseAudit.ts` and the `AuditUploader` component
- [ ] OpenGraph metadata & a full accessibility (contrast + keyboard nav) audit

## 🤝 Contributing

This started as a BitCamp 2026 project. Issues and pull requests are welcome — feel free to open one if you spot a bug or have an idea.

## 📄 License

No license has been applied yet; all rights reserved by the author for now.
