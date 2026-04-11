'use client';

import { useEffect, useState } from 'react';
import type { CourseCardProps } from './CourseCard';
import { getPlanetTerpProfessor } from '@/lib/api';

export type CourseDetailPopupProps = CourseCardProps & {
  open: boolean;
  onClose: () => void;
};

function parseMeeting(m: string) {
  const [days, start, end, building, room] = m.split('-');
  return { days, start, end, building, room };
}

export default function CourseDetailPopup({
  open,
  onClose,
  courseNumber,
  credits,
  title,
  description,
  profs,
  unlocks,
  sections = [],
}: CourseDetailPopupProps) {
  const [profRatings, setProfRatings] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || profs.length === 0) return;
    let cancelled = false;

    Promise.all(
      profs.map(async (p) => {
        const data = await getPlanetTerpProfessor(p.name);
        return [p.name, data?.average_rating ?? null] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setProfRatings(Object.fromEntries(entries));
    });

    return () => { cancelled = true; };
  }, [open, profs]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close details"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-popup-title"
        className="relative z-10 max-h-[min(90vh,48rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <header className="min-w-0 space-y-1">
            <p className="font-mono text-sm text-zinc-500">{courseNumber}</p>
            <h2 id="course-popup-title" className="text-xl font-semibold">
              {title}
            </h2>
            <p className="text-sm text-zinc-500">{credits} credits</p>
          </header>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <section className="mt-5">
          <h3 className="text-sm font-medium text-zinc-500">Description</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {description}
          </p>
        </section>

        {/* Available sections */}
        <section className="mt-5">
          <h3 className="text-sm font-medium text-zinc-500">Available Sections</h3>
          {sections.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-400">No sections available this semester.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {sections.map((s) => (
                <li
                  key={s.sec_code}
                  className="rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{s.sec_code}</span>
                    <span className="text-zinc-500 truncate">{s.instructors.join(', ')}</span>
                    <span className={`shrink-0 font-medium tabular-nums ${s.open_seats > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {s.open_seats}/{s.total_seats} open
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-zinc-400">
                    {s.meetings.map((m, i) => {
                      const { days, start, end, building, room } = parseMeeting(m);
                      return (
                        <div key={i}>{days} · {start}–{end} · {building} {room}</div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-medium text-zinc-500">Instructors</h3>
          {profs.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-400">None listed</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {profs.map((p) => {
                const rating = profRatings[p.name];
                return (
                  <li
                    key={p.name}
                    className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-zinc-500 tabular-nums">
                      {rating != null ? `${rating.toFixed(1)} ★` : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-medium text-zinc-500">
            Courses that require this one
          </h3>
          {unlocks.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-400">None listed</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {unlocks.map((code) => (
                <li
                  key={code}
                  className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-900"
                >
                  {code}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
