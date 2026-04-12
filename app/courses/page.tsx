'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type AuditResult } from '@/lib/parseAudit';
import { type Course, type JupSection } from '@/lib/api';
import { removeIneligibleCourses } from '@/lib/courses';
import CourseCard, { type CourseCardProps } from '@/app/components/CourseCard';

const UMDIO = 'https://api.umd.io/v1';
const JUPITERP = 'https://api.jupiterp.com';
const SEMESTER = '202608';

interface CourseWithSections extends Omit<Course, 'sections'> {
  sections: JupSection[];
}

async function fetchCoursesForGenEd(
  tag: string,
  completedIds: string[],
  inProgressIds: string[],
): Promise<CourseWithSections[]> {
  const res = await fetch(`${UMDIO}/courses?gen_ed=${tag}&per_page=50`);
  if (!res.ok) return [];
  const courses: Course[] = await res.json();

  const eligible = removeIneligibleCourses(courses, completedIds, inProgressIds);

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
    const inProgressIds = parsed.courses.in_progress_ids;

    if (missingGenEds.length === 0) {
      setLoading(false);
      return;
    }

    Promise.all(
      missingGenEds.map(async (tag) => {
        const courses = await fetchCoursesForGenEd(tag, completedIds, inProgressIds);
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


