'use client';

import { useState } from 'react';
import CourseDetailPopup from './CourseDetailPopup';
import type { JupSection } from '@/lib/api';

export type Prof = {
  name: string;
  stars: number;
  gpa: number;
};

export type CourseCardProps = {
  courseNumber: string;
  credits: number;
  title: string;
  description: string;
  profs: Prof[];
  /** Course codes for which this course is a prerequisite (downstream / "next" courses). */
  unlocks: string[];
  sections?: JupSection[];
  genEdTags?: string[];
};

export default function CourseCard(props: CourseCardProps) {
  const { courseNumber, credits, title, profs, unlocks, sections = [], genEdTags = [] } = props;
  const [popupOpen, setPopupOpen] = useState(false);

  const n = profs.filter(p => p.stars > 0).length;
  const avgStars = n > 0 ? profs.filter(p => p.stars > 0).reduce((sum, p) => sum + p.stars, 0) / n : null;
  const avgGpa   = n > 0 ? profs.filter(p => p.gpa   > 0).reduce((sum, p) => sum + p.gpa,   0) / n : null;

  const openSeats = sections.reduce((sum, s) => sum + s.open_seats, 0);
  const totalSeats = sections.reduce((sum, s) => sum + s.total_seats, 0);

  return (
    <>
      <article className="relative rounded-xl border border-zinc-200 bg-white p-4 pb-12 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-sm text-zinc-500">{courseNumber}</p>
            {unlocks.length > 0 && (
              <span
                className="shrink-0 font-mono text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-500"
                title="Prerequisite for other courses — see details"
                aria-label="Prerequisite for other courses; open details for the list"
              >
                (P)
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-zinc-500">{credits} cr</p>
          {genEdTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {genEdTags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-zinc-500">Avg. stars</dt>
            <dd className="font-medium">{avgStars != null ? avgStars.toFixed(1) : '—'}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Avg. GPA</dt>
            <dd className="font-medium">{avgGpa != null ? avgGpa.toFixed(2) : '—'}</dd>
          </div>
          {sections.length > 0 && (
            <>
              <div>
                <dt className="text-zinc-500">Sections</dt>
                <dd className="font-medium">{sections.length}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Open seats</dt>
                <dd className={`font-medium ${openSeats > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {openSeats}/{totalSeats}
                </dd>
              </div>
            </>
          )}
        </dl>

        <button
          type="button"
          onClick={() => setPopupOpen(true)}
          aria-label="Course details"
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm font-semibold leading-none text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
        >
          <span className="font-serif italic">i</span>
        </button>
      </article>

      <CourseDetailPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        {...props}
      />
    </>
  );
}
