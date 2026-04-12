'use client';

import { useEffect, useState } from 'react';
import CourseDetailPopup from './CourseDetailPopup';
import type { JupSection } from '@/lib/api';
import { getPlanetTerpCourse, getPlanetTerpProfessor } from '@/lib/api';
import type { OccupiedSectionPick } from '@/lib/courses';

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
  /** Planned sections on other courses; used to grey out conflicting times in the popup. */
  occupiedPlan?: OccupiedSectionPick[];
  /** When set, choosing an open section in the dialog records the pick (e.g. for a plan summary). */
  onPlanSectionSelect?: (pick: {
    courseNumber: string;
    title: string;
    sectionCode: string;
    /** Jupiter `meetings` strings (e.g. days-time-room) for the chosen section. */
    meetings: string[];
  }) => void;
};

export default function CourseCard({
  onPlanSectionSelect,
  occupiedPlan,
  courseNumber,
  credits,
  title,
  description,
  profs,
  unlocks,
  sections = [],
  genEdTags = [],
}: CourseCardProps) {
  const [popupOpen, setPopupOpen] = useState(false);

  const [courseGpa, setCourseGpa] = useState<number | null>(null);
  const [avgStars, setAvgStars] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPlanetTerpCourse(courseNumber).then(data => {
      if (!cancelled && data?.average_gpa != null) setCourseGpa(data.average_gpa);
    });

    const profNames = profs.map(p => p.name);
    if (profNames.length > 0) {
      Promise.all(profNames.map(getPlanetTerpProfessor)).then(results => {
        if (cancelled) return;
        const ratings = results
          .map(r => r?.average_rating)
          .filter((v): v is number => v != null && v > 0);
        if (ratings.length > 0) {
          setAvgStars(ratings.reduce((a, b) => a + b, 0) / ratings.length);
        }
      });
    }

    return () => { cancelled = true; };
  }, [courseNumber, profs]);

  const openSeats = sections.reduce((sum, s) => sum + s.open_seats, 0);
  const totalSeats = sections.reduce((sum, s) => sum + s.total_seats, 0);

  return (
    <>
      <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
            <dd className="font-medium">{courseGpa != null ? courseGpa.toFixed(2) : '—'}</dd>
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
          className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-900"
        >
          Select sections
        </button>
      </article>

      <CourseDetailPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        onSelectSection={
          onPlanSectionSelect
            ? (section) => {
                onPlanSectionSelect({
                  courseNumber,
                  title,
                  sectionCode: section.sec_code,
                  meetings: [...section.meetings],
                });
              }
            : undefined
        }
        courseNumber={courseNumber}
        credits={credits}
        title={title}
        description={description}
        profs={profs}
        unlocks={unlocks}
        sections={sections}
        genEdTags={genEdTags}
        occupiedPlan={occupiedPlan}
      />
    </>
  );
}
