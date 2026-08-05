'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatJupiterMeeting, getPlanetTerpProfessor, type JupSection } from '@/lib/api';
import { sectionConflictsOccupiedPlan } from '@/lib/courses';
import type { CourseCardProps } from './CourseCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export type CourseDetailPopupProps = Omit<CourseCardProps, 'onPlanSectionSelect'> & {
  open: boolean;
  onClose: () => void;
  onSelectSection?: (section: JupSection) => void;
};

export default function CourseDetailPopup({
  open,
  onClose,
  onSelectSection,
  occupiedPlan = [],
  courseNumber,
  credits,
  title,
  description,
  profs,
  unlocks,
  sections = [],
}: CourseDetailPopupProps) {
  const [profRatings, setProfRatings] = useState<Record<string, number | null>>({});

  const planBlocksOtherCourses = useMemo(
    () => (occupiedPlan?.length ?? 0) > 0,
    [occupiedPlan],
  );

  const profNamesKey = profs.map((p) => p.name.trim()).join('\0');

  useEffect(() => {
    if (!open || profs.length === 0) {
      setProfRatings({});
      return;
    }
    let cancelled = false;
    setProfRatings({});

    Promise.all(
      profs.map(async (p) => {
        const data = await getPlanetTerpProfessor(p.name);
        return [p.name, data?.average_rating ?? null] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setProfRatings(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [open, profNamesKey]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[min(90vh,48rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <p className="font-mono text-sm text-muted-foreground">{courseNumber}</p>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{credits} credits</DialogDescription>
        </DialogHeader>

        <section>
          <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
          <p className="mt-1 text-sm leading-relaxed">{description}</p>
        </section>

        <Separator />

        <section>
          <h3 className="text-sm font-medium text-muted-foreground">Available Sections</h3>
          {sections.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              No sections available this semester.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a section with open seats to select it and close this dialog.
                {planBlocksOtherCourses &&
                  ' Sections greyed out overlap another course you already put on your plan (same day, overlapping times).'}
              </p>
              <ul className="mt-2 space-y-2">
                {sections.map((s) => {
                  const hasOpenSeats = s.open_seats > 0;
                  const scheduleConflict =
                    planBlocksOtherCourses &&
                    sectionConflictsOccupiedPlan(s, occupiedPlan, courseNumber);
                  const selectable = hasOpenSeats && !scheduleConflict;
                  const body = (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium">{s.sec_code}</span>
                        <span className="min-w-0 truncate text-muted-foreground">
                          {s.instructors.join(', ')}
                        </span>
                        <span
                          className={`shrink-0 font-medium tabular-nums ${hasOpenSeats ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                        >
                          {s.open_seats}/{s.total_seats} open
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {s.meetings.map((m, i) => (
                          <div key={i}>{formatJupiterMeeting(m)}</div>
                        ))}
                      </div>
                    </>
                  );
                  return (
                    <li
                      key={s.sec_code}
                      className={`overflow-hidden rounded-lg border text-sm ${
                        selectable ? 'border-border' : 'border-border/60 bg-muted/40 opacity-70'
                      }`}
                    >
                      {selectable ? (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSection?.(s);
                            onClose();
                          }}
                          aria-label={`Select section ${s.sec_code}`}
                          className="w-full px-3 py-2 text-left transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          {body}
                        </button>
                      ) : (
                        <div
                          className="px-3 py-2"
                          title={
                            scheduleConflict
                              ? 'Overlaps meeting times from another course on your plan'
                              : 'No open seats — cannot select'
                          }
                        >
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <Separator />

        <section>
          <h3 className="text-sm font-medium text-muted-foreground">Instructors</h3>
          {profs.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None listed</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {profs.map((p) => {
                const rating = profRatings[p.name];
                return (
                  <li
                    key={p.name}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {rating != null ? `${rating.toFixed(1)} ★` : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Separator />

        <section>
          <h3 className="text-sm font-medium text-muted-foreground">
            Courses that require this one
          </h3>
          {unlocks.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None listed</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {unlocks.map((code) => (
                <li key={code}>
                  <Badge variant="secondary" className="font-mono">
                    {code}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
