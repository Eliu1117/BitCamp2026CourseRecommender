'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type AuditResult } from '@/lib/parseAudit';
import { type Course, type JupSection } from '@/lib/api';
import CourseCard, { type CourseCardProps } from '@/app/components/CourseCard';

const UMDIO = 'https://api.umd.io/v1';
const JUPITERP = 'https://api.jupiterp.com';
const SEMESTER = '202608';

interface CourseWithSections extends Omit<Course, 'sections'> {
  sections: JupSection[];
}

async function fetchCoursesForGenEd(tag: string, completedIds: string[]): Promise<CourseWithSections[]> {
  const res = await fetch(`${UMDIO}/courses?gen_ed=${tag}&per_page=30`);
  if (!res.ok) return [];
  const courses: Course[] = await res.json();

  const eligible = courses
    .filter(c => !completedIds.includes(c.course_id))
    .slice(0, 10);

  return Promise.all(
    eligible.map(async (course) => {
      try {
        const sRes = await fetch(`${JUPITERP}/v0/sections?courseCodes=${course.course_id}&semester=${SEMESTER}`);
        const sections: JupSection[] = sRes.ok ? await sRes.json() : [];
        return { ...course, sections };
      } catch {
        return { ...course, sections: [] };
      }
    })
  );
}

function toCourseCardProps(course: CourseWithSections): CourseCardProps {
  const uniqueInstructors = Array.from(
    new Set(course.sections.flatMap(s => s.instructors))
  );
  return {
    courseNumber: course.course_id,
    credits: parseFloat(course.credits) || 0,
    title: course.name,
    description: course.description,
    profs: uniqueInstructors.map(name => ({ name, stars: 0, gpa: 0 })),
    unlocks: [],
    sections: course.sections,
    genEdTags: (course.gen_ed ?? []).flat().filter(Boolean),
  };
}

export default function CoursesPage() {
  const router = useRouter();
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [coursesByGenEd, setCoursesByGenEd] = useState<Record<string, CourseWithSections[]>>({});
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

    if (missingGenEds.length === 0) {
      setLoading(false);
      return;
    }

    Promise.all(
      missingGenEds.map(async (tag) => {
        const courses = await fetchCoursesForGenEd(tag, completedIds);
        return [tag, courses] as [string, CourseWithSections[]];
      })
    ).then((entries) => {
      setCoursesByGenEd(Object.fromEntries(entries));
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
  const inProgressIds = audit.courses.in_progress_ids;

  return (
    <main className="px-6 py-12 space-y-10 max-w-6xl mx-auto">

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

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Credits Earned"  value={audit.credits.completed?.toString() ?? '—'} />
        <StatCard label="In Progress"     value={audit.credits.in_progress?.toString() ?? '—'} />
        <StatCard label="Still Needed"    value={audit.credits.needed?.toString() ?? '—'} />
        <StatCard label="Missing Gen-Eds" value={missingGenEds.length.toString()} />
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

      {/* Unfulfilled requirements */}
      {audit.summary.unfulfilled_requirements.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Unfulfilled Requirements</h2>
          <ul className="space-y-1">
            {audit.summary.unfulfilled_requirements.map(r => (
              <li key={r} className="text-sm text-zinc-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Courses by missing gen-ed */}
      {missingGenEds.length > 0 && (
        <div className="space-y-10">
          <h2 className="text-lg font-semibold">Courses That Fulfill Missing Gen-Eds</h2>
          {loading ? (
            <p className="text-zinc-400 text-sm animate-pulse">Fetching courses and sections...</p>
          ) : (
            missingGenEds.map(tag => {
              const courses = (coursesByGenEd[tag] ?? [])
                .filter(c => !inProgressIds.includes(c.course_id));
              return (
                <div key={tag} className="space-y-4">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-sm">{tag}</span>
                    <span className="text-zinc-400 font-normal text-sm">
                      {courses.length} course{courses.length !== 1 ? 's' : ''}
                    </span>
                  </h3>
                  {courses.length === 0 ? (
                    <p className="text-sm text-zinc-400">No eligible courses found.</p>
                  ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {courses.map(course => (
                        <CourseCard key={course.course_id} {...toCourseCardProps(course)} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-zinc-800">{value}</p>
    </div>
  );
}
