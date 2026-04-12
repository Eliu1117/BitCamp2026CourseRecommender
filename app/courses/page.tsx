'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type AuditResult } from '@/lib/parseAudit';
import { type Course, type JupSection } from '@/lib/api';
import {
  getAllCoursesByAttribute,
  getAllCoursesByGenEd,
  getDownstreamCourseIds,
  removeCoursesWithNoOpenSeats,
  removeGraduateLevelCourses,
  removeIneligibleCourses,
  sortCSCourses,
  sortGenEdCourses,
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

// #region agent log
let __agentUnlockPropsLogCount = 0;
// #endregion

function toCourseCardProps(
  course: CourseWithSections,
  cmscCatalog: Course[] | null,
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
  return {
    courseNumber: course.course_id,
    credits: parseFloat(course.credits) || 0,
    title: course.name,
    description: course.description,
    profs: uniqueInstructors.map(name => ({ name, stars: 0, gpa: 0 })),
    unlocks,
    sections: course.sections,
    genEdTags: (course.gen_ed ?? []).flat().filter(Boolean),
  };
}

const CS_BUCKET_LABELS: { key: 'lower' | 'upper' | 'electives'; title: string }[] = [
  { key: 'lower', title: 'Lower level (intro / core)' },
  { key: 'upper', title: 'Upper level' },
  { key: 'electives', title: 'CMSC electives (300–499)' },
];

export default function CoursesPage() {
  const router = useRouter();
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [coursesByGenEd, setCoursesByGenEd] = useState<Record<string, CourseWithSections[]>>({});
  const [csBuckets, setCsBuckets] = useState<SortedCSCourses<CourseWithSections> | null>(null);
  const [csCatalog, setCsCatalog] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
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
    csBuckets &&
    csBuckets.lower.length + csBuckets.upper.length + csBuckets.electives.length;

  return (
    <main className="px-6 py-12 space-y-10">

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
        {loading && (
          <p className="text-sm text-zinc-500">Loading CMSC catalog and sections…</p>
        )}
        {!loading && csBuckets && csTotal === 0 && (
          <p className="text-sm text-zinc-500">
            No CMSC courses to show: prerequisites and your audit already rule some out, and we only list undergraduate courses (below 500) with at least one open seat this term.
          </p>
        )}
        {!loading &&
          csBuckets &&
          CS_BUCKET_LABELS.map(({ key, title }) => {
            const list = csBuckets[key];
            if (list.length === 0) return null;
            return (
              <div key={key} className="space-y-3">
                <h3 className="text-base font-medium text-zinc-700 dark:text-zinc-300">{title}</h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((course) => (
                    <CourseCard
                      key={course.course_id}
                      {...toCourseCardProps(course, csCatalog)}
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
          {loading && (
            <p className="text-sm text-zinc-500">Loading gen-ed courses and sections…</p>
          )}
          {!loading &&
            missingGenEds.map((tag) => {
              const list = coursesByGenEd[tag] ?? [];
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
                            {...toCourseCardProps(course, null)}
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


