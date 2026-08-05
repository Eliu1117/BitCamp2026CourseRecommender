'use client';

import { useEffect, useState } from 'react';
import CourseDetailPopup from './CourseDetailPopup';
import type { JupSection } from '@/lib/api';
import { getPlanetTerpCourse, getPlanetTerpProfessor } from '@/lib/api';
import type { OccupiedSectionPick } from '@/lib/courses';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  /** PlanetTerp course average GPA when the parent already fetched it (skips duplicate course API call). */
  planetTerpCourseGpa?: number;
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
  planetTerpCourseGpa,
}: CourseCardProps) {
  const [popupOpen, setPopupOpen] = useState(false);

  // `courseGpa`/`avgStars` only ever hold *fetched* values; when the caller already
  // supplies `planetTerpCourseGpa` or there are no profs to look up, we render directly
  // from props/derived values below instead of mirroring them into state.
  const [courseGpa, setCourseGpa] = useState<number | null>(null);
  const [gpaLoading, setGpaLoading] = useState(true);
  const [avgStars, setAvgStars] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const profNamesKey = profs.map((p) => p.name.trim()).join('\0');
  const hasKnownGpa = planetTerpCourseGpa != null && planetTerpCourseGpa > 0;
  const displayGpa = hasKnownGpa ? planetTerpCourseGpa : courseGpa;

  useEffect(() => {
    if (hasKnownGpa) return;
    let cancelled = false;
    getPlanetTerpCourse(courseNumber).then((data) => {
      if (cancelled) return;
      const g = data?.average_gpa;
      setCourseGpa(g != null && g > 0 ? g : null);
      setGpaLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [courseNumber, hasKnownGpa]);

  useEffect(() => {
    if (!profNamesKey) return;
    let cancelled = false;
    const profNames = profNamesKey.split('\0');
    Promise.all(profNames.map(getPlanetTerpProfessor)).then((results) => {
      if (cancelled) return;
      const ratings = results
        .map((r) => r?.average_rating)
        .filter((v): v is number => v != null && v > 0);
      setAvgStars(ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null);
      setStatsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [courseNumber, profNamesKey]);

  const openSeats = sections.reduce((sum, s) => sum + s.open_seats, 0);
  const totalSeats = sections.reduce((sum, s) => sum + s.total_seats, 0);

  return (
    <>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-mono text-sm text-muted-foreground">{courseNumber}</p>
            {unlocks.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="shrink-0 font-mono text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-500"
                    aria-label="Prerequisite for other courses; open details for the list"
                  >
                    (P)
                  </span>
                </TooltipTrigger>
                <TooltipContent>Prerequisite for other courses — see details</TooltipContent>
              </Tooltip>
            )}
          </div>
          <h2 className="text-lg font-semibold leading-snug">{title}</h2>
          <p className="text-sm text-muted-foreground">{credits} cr</p>
          {genEdTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {genEdTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-mono">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Avg. stars</dt>
              {profNamesKey && statsLoading ? (
                <Skeleton className="mt-1 h-4 w-10" />
              ) : (
                <dd className="font-medium">{avgStars != null ? avgStars.toFixed(1) : '—'}</dd>
              )}
            </div>
            <div>
              <dt className="text-muted-foreground">Avg. GPA</dt>
              {!hasKnownGpa && gpaLoading ? (
                <Skeleton className="mt-1 h-4 w-10" />
              ) : (
                <dd className="font-medium">{displayGpa != null ? displayGpa.toFixed(2) : '—'}</dd>
              )}
            </div>
            {sections.length > 0 && (
              <>
                <div>
                  <dt className="text-muted-foreground">Sections</dt>
                  <dd className="font-medium">{sections.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Open seats</dt>
                  <dd
                    className={`font-medium ${openSeats > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                  >
                    {openSeats}/{totalSeats}
                  </dd>
                </div>
              </>
            )}
          </dl>

          <Button
            type="button"
            variant="outline"
            onClick={() => setPopupOpen(true)}
            className="mt-4 w-full"
          >
            Select sections
          </Button>
        </CardContent>
      </Card>

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
