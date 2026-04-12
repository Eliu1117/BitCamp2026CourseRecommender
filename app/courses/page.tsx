'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

const JUPITERP = 'https://api.jupiterp.com';
const SEMESTER = '202608';
const TOP_GEN_ED_COURSES_PER_TAG = 10;

interface CourseWithSections extends Omit<Course, 'sections'> {
  sections: JupSection[];
}

async function attachJupSections(course: Course): Promise<CourseWithSections> {
  try {
    const sRes = await fetch(
      `${JUPITERP}/v0/sections?courseCodes=${course.course_id}&semester=${SEMESTER}`,
    );
    const sections: JupSection[] = sRes.ok ? await sRes.json() : [];
    return { ...course, sections };
  } catch {
    return { ...course, sections: [] };
  }
}

async function loadGenEdCoursesForTag(
  tag: string,
  completedIds: string[],
  inProgressIds: string[],
  allMissingTags: string[],
): Promise<CourseWithSections[]> {
  const courses = await getAllCoursesByGenEd(tag);
  const eligible = removeIneligibleCourses(courses, completedIds, inProgressIds);
  const undergrad = removeGraduateLevelCourses(eligible);
  const withSections = await Promise.all(undergrad.map(attachJupSections));
  const withOpenSeats = removeCoursesWithNoOpenSeats(withSections);
  return sortGenEdCourses(withOpenSeats, allMissingTags);
}

async function loadSortedCSCoursesWithSections(
  completedIds: string[],
  inProgressIds: string[],
): Promise<{
  buckets: SortedCSCourses<CourseWithSections>;
  catalog: Course[];
}> {
  const catalogRaw = await getAllCoursesByAttribute({ dept_id: 'CMSC' });
  const catalog = removeGraduateLevelCourses(catalogRaw);
  // #region agent log
  {
    const COURSE_ID_IN_PREREQ = /\b[A-Z]{4}\d{3}\b/g;
    const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase();
    const withPrereqText = catalog.filter(
      (c) => (c.relationships?.prereqs?.length ?? 0) > 0,
    ).length;
    const downstreamFrom = (target: string) =>
      catalog
        .filter((c) => {
          const p = c.relationships?.prereqs;
          if (!p) return false;
          const m = p.match(COURSE_ID_IN_PREREQ);
          return (m ?? []).some((id) => norm(id) === norm(target));
        })
        .map((c) => c.course_id);
    const d132 = downstreamFrom('CMSC132');
    const sampleIds = catalog.slice(0, 5).map((c) => c.course_id);
    fetch('http://127.0.0.1:7283/ingest/f76f60ef-6faa-4524-b568-c2174a389ed1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486541' },
      body: JSON.stringify({
        sessionId: '486541',
        runId: 'post-fix',
        hypothesisId: 'B',
        location: 'courses/page.tsx:loadSortedCSCoursesWithSections',
        message: 'catalog prereq + reverse-lookup probe',
        data: {
          catalogLen: catalog.length,
          coursesWithPrereqText: withPrereqText,
          sampleCourseIdFormats: sampleIds,
          downstreamCountCMSC132: d132.length,
          downstreamSampleCMSC132: d132.slice(0, 10),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  const eligible = removeIneligibleCourses(catalog, completedIds, inProgressIds);
  const sorted = sortCSCourses(eligible, { catalogForUnlocks: catalog });

  const withSections = async (courses: Course[]) => {
    const attached = await Promise.all(courses.map(attachJupSections));
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

// #region agent log
let __agentUnlockPropsLogCount = 0;
// #endregion

function toCourseCardProps(
  course: CourseWithSections,
  cmscCatalog: Course[] | null,
  planetTerpGpaByCourse: Record<string, number>,
): CourseCardProps {
  const unlocks =
    cmscCatalog && cmscCatalog.length > 0
      ? getDownstreamCourseIds(cmscCatalog, course.course_id)
      : [];
  // #region agent log
  if (__agentUnlockPropsLogCount < 6) {
    __agentUnlockPropsLogCount++;
    fetch('http://127.0.0.1:7283/ingest/f76f60ef-6faa-4524-b568-c2174a389ed1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486541' },
      body: JSON.stringify({
        sessionId: '486541',
        runId: 'post-fix',
        hypothesisId: 'A',
        location: 'courses/page.tsx:toCourseCardProps',
        message: 'props passed to CourseCard (unlocks source)',
        data: {
          course_id: course.course_id,
          unlocksLength: unlocks.length,
          unlocksSource:
            cmscCatalog && cmscCatalog.length > 0 ? 'getDownstreamCourseIds' : 'no_catalog',
          unlocksSample: unlocks.slice(0, 5),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
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

type PlannedSection = {
  courseNumber: string;
  sectionCode: string;
  title: string;
  meetings: string[];
};

export default function CoursesPage() {
  const router = useRouter();
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [coursesByGenEd, setCoursesByGenEd] = useState<Record<string, CourseWithSections[]>>({});
  const [csBuckets, setCsBuckets] = useState<SortedCSCourses<CourseWithSections> | null>(null);
  const [csCatalog, setCsCatalog] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [plannedSections, setPlannedSections] = useState<PlannedSection[]>([]);
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
    setAudit(parsed);

    const missingGenEds = parsed.gen_ed.unfulfilled;
    const completedIds = parsed.courses.completed_ids;
    const inProgressIds = parsed.courses.in_progress_ids;

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
              );
              return [tag, courses] as [string, CourseWithSections[]];
            }),
          ).then((entries) => Object.fromEntries(entries));

    Promise.all([
      loadSortedCSCoursesWithSections(completedIds, inProgressIds),
      genEdTask,
    ]).then(([cs, genEdMap]) => {
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
    });
  }, [router]);

  if (!audit) {
    return (
      <main className="px-6 py-12">
        <p className="text-zinc-400">Loading audit data...</p>
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
    <main className="relative px-6 py-12 space-y-10">
      <aside
        className="fixed top-4 right-4 z-40 w-[min(calc(100vw-2rem),18rem)] rounded-xl border border-zinc-200 bg-white/95 p-4 text-sm shadow-lg backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/95"
        aria-label="Selected course sections"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Selected sections
        </h2>
        {plannedSections.length === 0 ? (
          <p className="mt-2 leading-snug text-zinc-500 dark:text-zinc-400">
            None yet. Open a course and pick a section with open seats.
          </p>
        ) : (
          <ul className="mt-3 max-h-[min(50vh,20rem)] space-y-3 overflow-y-auto pr-0.5">
            {plannedSections.map((row) => (
              <li
                key={row.courseNumber}
                className="rounded-lg border border-zinc-100 p-2 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {row.courseNumber}
                  </p>
                  <button
                    type="button"
                    onClick={() => removePlannedCourse(row.courseNumber)}
                    className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                    aria-label={`Remove ${row.courseNumber} from selected sections`}
                  >
                    Remove
                  </button>
                </div>
                <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{row.title}</p>
                <p className="mt-1 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {row.sectionCode}
                </p>
                {row.meetings.length > 0 ? (
                  <ul className="mt-1.5 space-y-0.5 border-t border-zinc-100 pt-1.5 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                    {row.meetings.map((m, i) => (
                      <li key={i}>{formatJupiterMeeting(m)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-zinc-400">No meeting times listed.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Course Recommendations</h1>
        <p className="text-zinc-500 text-sm">
          {audit.student.name ?? 'Student'}
          {audit.credits.completed != null && ` · ${audit.credits.completed} credits completed`}
          {audit.credits.in_progress != null && ` · ${audit.credits.in_progress} in progress`}
          {audit.credits.needed != null && ` · ${audit.credits.needed} still needed`}
        </p>
      </div>


      {/* Missing gen-ed badges */}
      {missingGenEds.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Missing Gen-Eds</h2>
          <div className="flex gap-2 flex-wrap">
            {missingGenEds.map(g => (
              <span key={g} className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-mono font-medium">
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      <section className="space-y-8">
        <h2 className="text-lg font-semibold">CS course recommendations</h2>
        {occupiedPicks.length > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Lists hide courses that only have open sections overlapping your selected meeting times
            (M/T/W/R/F). Courses already in your selection stay visible.
          </p>
        )}
        {loading && (
          <p className="text-sm text-zinc-500">Loading CMSC catalog and sections…</p>
        )}
        {!loading && csBucketsDisplay && csTotal === 0 && (
          <p className="text-sm text-zinc-500">
            No CMSC courses to show: prerequisites and your audit already rule some out, and we only list undergraduate courses (below 500) with at least one open seat this term.
          </p>
        )}
        {!loading &&
          csBucketsDisplay &&
          CS_BUCKET_LABELS.map(({ key, title }) => {
            const list = csBucketsDisplay[key];
            if (list.length === 0) return null;
            return (
              <div key={key} className="space-y-3">
                <h3 className="text-base font-medium text-zinc-700 dark:text-zinc-300">{title}</h3>
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
              </div>
            );
          })}
      </section>

      {missingGenEds.length > 0 && (
        <section className="space-y-8 border-t border-zinc-100 pt-10">
          <h2 className="text-lg font-semibold">Gen-Ed course recommendations</h2>
          {occupiedPicks.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Same schedule filter: only courses with at least one open section that does not overlap
              your selections.
            </p>
          )}
          {loading && (
            <p className="text-sm text-zinc-500">Loading gen-ed courses and sections…</p>
          )}
          {!loading &&
            missingGenEds.map((tag) => {
              const list = coursesByGenEdDisplay[tag] ?? [];
              const top = list.slice(0, TOP_GEN_ED_COURSES_PER_TAG);
              return (
                <div key={tag} className="space-y-3">
                  <h3 className="text-base font-medium text-zinc-700 dark:text-zinc-300">
                    <span className="font-mono">{tag}</span>
                  </h3>
                  {list.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No undergraduate courses with open seats for this tag after your audit and
                      prerequisite filters.
                    </p>
                  ) : (
                    <>
                      {list.length > TOP_GEN_ED_COURSES_PER_TAG && (
                        <p className="text-xs text-zinc-500">
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
                </div>
              );
            })}
        </section>
      )}

      <div className="pt-4 border-t border-zinc-100">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          ← Upload a different audit
        </button>
      </div>
    </main>
  );
}


