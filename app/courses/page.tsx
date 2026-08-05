'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ClipboardList, X } from 'lucide-react';
import { toast } from 'sonner';

import { type AuditResult } from '@/lib/parseAudit';
import { formatJupiterMeeting, getPlanetTerpCourse, type Course, type JupSection } from '@/lib/api';
import {
  getAllCoursesByAttribute,
  getAllCoursesByGenEd,
  getDownstreamCourseIds,
  normalizeCourseId,
  removeCoursesWithNoOpenSeats,
  removeGraduateLevelCourses,
  removeIneligibleCourses,
  removeOccupiedTimes,
  resortCSCoursesByUnlocksAndGpa,
  sortCSCourses,
  sortGenEdCourses,
  sortGenEdCoursesWithPlanetTerpGpa,
  type SortedCSCourses,
} from '@/lib/courses';
import CourseCard, { type CourseCardProps } from '@/app/components/CourseCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const JUPITERP = 'https://api.jupiterp.com';
const SEMESTER = '202608';
const TOP_GEN_ED_COURSES_PER_TAG = 10;

interface CourseWithSections extends Omit<Course, 'sections'> {
  sections: JupSection[];
}

async function attachJupSections(
  course: Course,
  onError?: () => void,
): Promise<CourseWithSections> {
  try {
    const sRes = await fetch(
      `${JUPITERP}/v0/sections?courseCodes=${course.course_id}&semester=${SEMESTER}`,
    );
    if (!sRes.ok) {
      onError?.();
      return { ...course, sections: [] };
    }
    const sections: JupSection[] = await sRes.json();
    return { ...course, sections };
  } catch {
    onError?.();
    return { ...course, sections: [] };
  }
}

async function loadGenEdCoursesForTag(
  tag: string,
  completedIds: string[],
  inProgressIds: string[],
  allMissingTags: string[],
  onSectionError?: () => void,
): Promise<CourseWithSections[]> {
  const courses = await getAllCoursesByGenEd(tag);
  const eligible = removeIneligibleCourses(courses, completedIds, inProgressIds);
  const undergrad = removeGraduateLevelCourses(eligible);
  const withSections = await Promise.all(
    undergrad.map((c) => attachJupSections(c, onSectionError)),
  );
  const withOpenSeats = removeCoursesWithNoOpenSeats(withSections);
  return sortGenEdCourses(withOpenSeats, allMissingTags);
}

async function loadSortedCSCoursesWithSections(
  completedIds: string[],
  inProgressIds: string[],
  onSectionError?: () => void,
): Promise<{
  buckets: SortedCSCourses<CourseWithSections>;
  catalog: Course[];
}> {
  const catalogRaw = await getAllCoursesByAttribute({ dept_id: 'CMSC' });
  const catalog = removeGraduateLevelCourses(catalogRaw);
  const eligible = removeIneligibleCourses(catalog, completedIds, inProgressIds);
  const sorted = sortCSCourses(eligible, { catalogForUnlocks: catalog });

  const withSections = async (courses: Course[]) => {
    const attached = await Promise.all(
      courses.map((c) => attachJupSections(c, onSectionError)),
    );
    return removeCoursesWithNoOpenSeats(attached);
  };

  return {
    buckets: {
      lower: await withSections(sorted.lower),
      upper: await withSections(sorted.upper),
      electives: await withSections(sorted.electives),
      other: [],
    },
    catalog,
  };
}

function collectNormalizedCourseIds(
  buckets: SortedCSCourses<CourseWithSections>,
  genEdMap: Record<string, CourseWithSections[]>,
): string[] {
  const s = new Set<string>();
  for (const c of buckets.lower) s.add(normalizeCourseId(c.course_id));
  for (const c of buckets.upper) s.add(normalizeCourseId(c.course_id));
  for (const c of buckets.electives) s.add(normalizeCourseId(c.course_id));
  for (const c of buckets.other) s.add(normalizeCourseId(c.course_id));
  for (const list of Object.values(genEdMap)) {
    for (const c of list) s.add(normalizeCourseId(c.course_id));
  }
  return [...s];
}

function toCourseCardProps(
  course: CourseWithSections,
  cmscCatalog: Course[] | null,
  planetTerpGpaByCourse: Record<string, number>,
): CourseCardProps {
  const unlocks =
    cmscCatalog && cmscCatalog.length > 0
      ? getDownstreamCourseIds(cmscCatalog, course.course_id)
      : [];
  const uniqueInstructors = Array.from(
    new Set(course.sections.flatMap(s => s.instructors))
  );
  const nid = normalizeCourseId(course.course_id);
  const batchGpa = planetTerpGpaByCourse[nid];
  return {
    courseNumber: course.course_id,
    credits: parseFloat(course.credits) || 0,
    title: course.name,
    description: course.description,
    profs: uniqueInstructors.map(name => ({ name, stars: 0, gpa: 0 })),
    unlocks,
    sections: course.sections,
    genEdTags: (course.gen_ed ?? []).flat().filter(Boolean),
    planetTerpCourseGpa:
      batchGpa != null && batchGpa > 0 ? batchGpa : undefined,
  };
}

const CS_BUCKET_LABELS: { key: 'lower' | 'upper' | 'electives'; title: string }[] = [
  { key: 'lower', title: 'Lower level (intro / core)' },
  { key: 'upper', title: 'Upper level' },
  { key: 'electives', title: 'CMSC electives (300–499)' },
];

const UPPER_LEVEL_REQUIRED_COURSES = 5;
const UPPER_LEVEL_REQUIRED_AREAS = 3;
const CMSC_ELECTIVE_CREDITS_REQUIRED = 6;

function sumCreditsForCourseIds(audit: AuditResult, courseIds: string[]): number {
  const ids = new Set(courseIds.map((id) => normalizeCourseId(id)));
  let sum = 0;
  for (const c of audit.courses.all) {
    if (ids.has(normalizeCourseId(c.course_id))) sum += c.credits;
  }
  return sum;
}

/** Five upper-level courses from at least three of five areas (from `upper_level_requirements.areas`). */
function formatUpperLevelProgress(audit: AuditResult): string | null {
  const { areas } = audit.upper_level_requirements;
  if (!areas.length) return null;
  const seenCourses = new Set<string>();
  let areasWithActivity = 0;
  for (const a of areas) {
    const ids = [...a.courses_taken, ...a.courses_in_progress];
    if (ids.length > 0) areasWithActivity++;
    for (const id of ids) seenCourses.add(normalizeCourseId(id));
  }
  const coursesDone = seenCourses.size;
  return `${coursesDone}/${UPPER_LEVEL_REQUIRED_COURSES} courses · ${areasWithActivity}/${UPPER_LEVEL_REQUIRED_AREAS} areas`;
}

/** CMSC 300/400 elective credits (audit lists applied courses; requirement is 6 credits). */
function formatCMSCelectiveProgress(audit: AuditResult): string | null {
  const e = audit.cmsc_electives;
  const ids = [...e.courses_taken, ...e.courses_in_progress];
  const applied = sumCreditsForCourseIds(audit, ids);
  return `${applied}/${CMSC_ELECTIVE_CREDITS_REQUIRED} cr`;
}

function csBucketProgressLabel(
  audit: AuditResult,
  key: 'lower' | 'upper' | 'electives',
): string | null {
  if (key === 'upper') return formatUpperLevelProgress(audit);
  if (key === 'electives') return formatCMSCelectiveProgress(audit);
  return null;
}

type PlannedSection = {
  courseNumber: string;
  sectionCode: string;
  title: string;
  meetings: string[];
};

function CourseCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-10" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}

function CourseGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

function SelectedSectionsList({
  plannedSections,
  removePlannedCourse,
}: {
  plannedSections: PlannedSection[];
  removePlannedCourse: (courseNumber: string) => void;
}) {
  if (plannedSections.length === 0) {
    return (
      <p className="text-sm leading-snug text-muted-foreground">
        None yet. Open a course and pick a section with open seats.
      </p>
    );
  }

  return (
    <ul className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto pr-0.5">
      {plannedSections.map((row) => (
        <li key={row.courseNumber} className="rounded-lg border border-border p-2">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 font-mono text-sm font-semibold">{row.courseNumber}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removePlannedCourse(row.courseNumber)}
              className="h-auto shrink-0 px-2 py-0.5 text-xs text-destructive hover:text-destructive"
              aria-label={`Remove ${row.courseNumber} from selected sections`}
            >
              Remove
            </Button>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{row.title}</p>
          <p className="mt-1 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {row.sectionCode}
          </p>
          {row.meetings.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 border-t border-border pt-1.5 text-xs text-muted-foreground">
              {row.meetings.map((m, i) => (
                <li key={i}>{formatJupiterMeeting(m)}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No meeting times listed.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CoursesPage() {
  const router = useRouter();
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [coursesByGenEd, setCoursesByGenEd] = useState<Record<string, CourseWithSections[]>>({});
  const [csBuckets, setCsBuckets] = useState<SortedCSCourses<CourseWithSections> | null>(null);
  const [csCatalog, setCsCatalog] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plannedSections, setPlannedSections] = useState<PlannedSection[]>([]);
  const [selectionsSheetOpen, setSelectionsSheetOpen] = useState(false);
  const [planetTerpGpaByCourse, setPlanetTerpGpaByCourse] = useState<
    Record<string, number>
  >({});

  const onPlanSectionSelect = useCallback(
    (pick: {
      courseNumber: string;
      title: string;
      sectionCode: string;
      meetings: string[];
    }) => {
      setPlannedSections((prev) => {
        const i = prev.findIndex((p) => p.courseNumber === pick.courseNumber);
        const row: PlannedSection = {
          courseNumber: pick.courseNumber,
          sectionCode: pick.sectionCode,
          title: pick.title,
          meetings: [...pick.meetings],
        };
        if (i >= 0) {
          const next = [...prev];
          next[i] = row;
          return next;
        }
        return [...prev, row];
      });
      toast.success(`${pick.courseNumber} section ${pick.sectionCode} added to your plan`);
    },
    [],
  );

  const removePlannedCourse = useCallback((courseNumber: string) => {
    setPlannedSections((prev) => prev.filter((p) => p.courseNumber !== courseNumber));
  }, []);

  const occupiedPicks = useMemo(
    () =>
      plannedSections.map((p) => ({
        courseNumber: p.courseNumber,
        meetings: p.meetings,
      })),
    [plannedSections],
  );

  const csBucketsDisplay = useMemo(() => {
    if (!csBuckets) return null;
    if (occupiedPicks.length === 0) return csBuckets;
    return {
      lower: removeOccupiedTimes(csBuckets.lower, occupiedPicks),
      upper: removeOccupiedTimes(csBuckets.upper, occupiedPicks),
      electives: removeOccupiedTimes(csBuckets.electives, occupiedPicks),
      other: csBuckets.other,
    };
  }, [csBuckets, occupiedPicks]);

  const coursesByGenEdDisplay = useMemo(() => {
    if (occupiedPicks.length === 0) return coursesByGenEd;
    const out: Record<string, CourseWithSections[]> = {};
    for (const [tag, list] of Object.entries(coursesByGenEd)) {
      out[tag] = removeOccupiedTimes(list, occupiedPicks);
    }
    return out;
  }, [coursesByGenEd, occupiedPicks]);

  useEffect(() => {
    const raw = sessionStorage.getItem('auditResult');
    if (!raw) {
      router.replace('/');
      return;
    }
    const parsed = JSON.parse(raw) as AuditResult;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads sessionStorage (external system); this hand-off is replaced by Context/Zustand in Phase 2.
    setAudit(parsed);

    const missingGenEds = parsed.gen_ed.unfulfilled;
    const completedIds = parsed.courses.completed_ids;
    const inProgressIds = parsed.courses.in_progress_ids;

    let sectionErrorShown = false;
    const notifySectionError = () => {
      if (sectionErrorShown) return;
      sectionErrorShown = true;
      toast.warning('Some section data could not be loaded', {
        description: 'JupiterP may be temporarily unavailable — showing what we could fetch.',
      });
    };

    const genEdTask =
      missingGenEds.length === 0
        ? Promise.resolve({} as Record<string, CourseWithSections[]>)
        : Promise.all(
            missingGenEds.map(async (tag) => {
              const courses = await loadGenEdCoursesForTag(
                tag,
                completedIds,
                inProgressIds,
                missingGenEds,
                notifySectionError,
              );
              return [tag, courses] as [string, CourseWithSections[]];
            }),
          ).then((entries) => Object.fromEntries(entries));

    Promise.all([
      loadSortedCSCoursesWithSections(completedIds, inProgressIds, notifySectionError),
      genEdTask,
    ])
      .then(([cs, genEdMap]) => {
        setCsBuckets(cs.buckets);
        setCsCatalog(cs.catalog);
        setCoursesByGenEd(genEdMap);
        setPlanetTerpGpaByCourse({});
        setLoading(false);

        const ids = collectNormalizedCourseIds(cs.buckets, genEdMap);
        if (ids.length === 0) return;

        Promise.all(
          ids.map(async (nid) => {
            const data = await getPlanetTerpCourse(nid);
            const g = data?.average_gpa;
            return [nid, typeof g === 'number' && g > 0 ? g : null] as const;
          }),
        ).then((pairs) => {
          const map = new Map<string, number>();
          for (const [nid, g] of pairs) {
            if (g != null) map.set(nid, g);
          }
          if (map.size === 0) return;
          setPlanetTerpGpaByCourse(Object.fromEntries(map));
          setCsBuckets((prev) =>
            prev ? resortCSCoursesByUnlocksAndGpa(prev, cs.catalog, map) : prev,
          );
          setCoursesByGenEd((prev) => {
            const next: Record<string, CourseWithSections[]> = {};
            for (const [tag, list] of Object.entries(prev)) {
              next[tag] = sortGenEdCoursesWithPlanetTerpGpa(list, missingGenEds, map);
            }
            return next;
          });
        });
      })
      .catch((e: unknown) => {
        const message =
          e instanceof Error ? e.message : 'Failed to load course recommendations.';
        setLoadError(message);
        setLoading(false);
        toast.error('Could not load course recommendations', { description: message });
      });
  }, [router]);

  if (!audit) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </main>
    );
  }

  const missingGenEds = audit.gen_ed.unfulfilled;

  const csTotal =
    csBucketsDisplay &&
    csBucketsDisplay.lower.length +
      csBucketsDisplay.upper.length +
      csBucketsDisplay.electives.length;

  return (
    <main className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:pr-[19rem]">
      {/* Desktop sticky selections panel */}
      <Card
        className="fixed top-4 right-4 z-40 hidden w-[18rem] p-0 shadow-lg backdrop-blur-sm lg:block"
        aria-label="Selected course sections"
      >
        <CardHeader>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Selected sections
          </h2>
        </CardHeader>
        <CardContent>
          <SelectedSectionsList
            plannedSections={plannedSections}
            removePlannedCourse={removePlannedCourse}
          />
        </CardContent>
      </Card>

      {/* Mobile/tablet floating trigger + sheet */}
      <div className="fixed bottom-4 right-4 z-40 lg:hidden">
        <Sheet open={selectionsSheetOpen} onOpenChange={setSelectionsSheetOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="shadow-lg">
              <ClipboardList />
              Selections
              {plannedSections.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {plannedSections.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>Selected sections</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-4">
              <SelectedSectionsList
                plannedSections={plannedSections}
                removePlannedCourse={removePlannedCourse}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Course Recommendations</h1>
        <p className="text-sm text-muted-foreground">
          {audit.student.name ?? 'Student'}
          {audit.credits.completed != null && ` · ${audit.credits.completed} credits completed`}
          {audit.credits.in_progress != null && ` · ${audit.credits.in_progress} in progress`}
          {audit.credits.needed != null && ` · ${audit.credits.needed} still needed`}
        </p>
      </div>

      {/* Raw parsed audit data */}
      <Accordion type="single" collapsible className="mt-6">
        <AccordionItem value="raw-audit">
          <AccordionTrigger>View parsed audit data</AccordionTrigger>
          <AccordionContent>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
              {JSON.stringify(audit, null, 2)}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {loadError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError} Try refreshing the page, or{' '}
          <button
            type="button"
            onClick={() => router.push('/')}
            className="underline underline-offset-2"
          >
            upload your audit again
          </button>
          .
        </div>
      )}

      {/* Missing gen-ed badges */}
      {missingGenEds.length > 0 && (
        <div className="mt-8 space-y-2">
          <h2 className="text-lg font-semibold">Missing Gen-Eds</h2>
          <div className="flex flex-wrap gap-2">
            {missingGenEds.map((g) => (
              <Badge key={g} variant="secondary" className="font-mono">
                {g}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <section className="mt-10 space-y-8">
        <h2 className="text-lg font-semibold">CS course recommendations</h2>
        {occupiedPicks.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Lists hide courses that only have open sections overlapping your selected meeting times
            (M/T/W/R/F). Courses already in your selection stay visible.
          </p>
        )}
        {loading && <CourseGridSkeleton />}
        {!loading && csBucketsDisplay && csTotal === 0 && (
          <p className="text-sm text-muted-foreground">
            No CMSC courses to show: prerequisites and your audit already rule some out, and we only list undergraduate courses (below 500) with at least one open seat this term.
          </p>
        )}
        {!loading &&
          csBucketsDisplay &&
          CS_BUCKET_LABELS.map(({ key, title }) => {
            const list = csBucketsDisplay[key];
            if (list.length === 0) return null;
            const csProgress = csBucketProgressLabel(audit, key);
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-3"
              >
                <h3 className="text-base font-medium text-foreground/80">
                  <span>{title}</span>
                  {csProgress != null && (
                    <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                      · {csProgress}
                    </span>
                  )}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((course) => (
                    <CourseCard
                      key={course.course_id}
                      {...toCourseCardProps(course, csCatalog, planetTerpGpaByCourse)}
                      occupiedPlan={occupiedPicks}
                      onPlanSectionSelect={onPlanSectionSelect}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
      </section>

      {missingGenEds.length > 0 && (
        <section className="mt-10 space-y-8 border-t border-border pt-10">
          <h2 className="text-lg font-semibold">Gen-Ed course recommendations</h2>
          {occupiedPicks.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Same schedule filter: only courses with at least one open section that does not overlap
              your selections.
            </p>
          )}
          {loading && <CourseGridSkeleton />}
          {!loading &&
            missingGenEds.map((tag) => {
              const list = coursesByGenEdDisplay[tag] ?? [];
              const top = list.slice(0, TOP_GEN_ED_COURSES_PER_TAG);
              return (
                <motion.div
                  key={tag}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-3"
                >
                  <h3 className="text-base font-medium text-foreground/80">
                    <span className="font-mono">{tag}</span>
                  </h3>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No undergraduate courses with open seats for this tag after your audit and
                      prerequisite filters.
                    </p>
                  ) : (
                    <>
                      {list.length > TOP_GEN_ED_COURSES_PER_TAG && (
                        <p className="text-xs text-muted-foreground">
                          Top {TOP_GEN_ED_COURSES_PER_TAG} of {list.length} (most overlapping missing
                          tags, then average GPA).
                        </p>
                      )}
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {top.map((course) => (
                          <CourseCard
                            key={`${tag}-${course.course_id}`}
                            {...toCourseCardProps(course, null, planetTerpGpaByCourse)}
                            occupiedPlan={occupiedPicks}
                            onPlanSectionSelect={onPlanSectionSelect}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
        </section>
      )}

      <div className="mt-10 border-t border-border pt-4">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-muted-foreground">
          <X /> Upload a different audit
        </Button>
      </div>
    </main>
  );
}
