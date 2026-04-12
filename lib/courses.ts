import { umdio, Course, getJupSections } from '@/lib/api';

export async function getAllCoursesByAttribute(params?: {dept_id?: string; semester?: number; credits?: number; }): Promise<Course[]> {
    const results: Course[] = [];
    let page = 1;
    const MAX_PAGES = 50;
    while (page <= MAX_PAGES) {
        const batch = await umdio.courses.list({
          ...(params?.dept_id   && { dept_id:  params.dept_id }),
          ...(params?.semester  && { semester: params.semester.toString() }),
          ...(params?.credits   && { credits:  params.credits.toString() }),
          per_page: 100,
          page,
        });
        results.push(...batch);
        if (batch.length < 100) break;
        page++
    }
    return results;
  }

 export async function getAllCoursesByGenEd(tag: string) {
    const results = [];
    let page = 1;
    while (true) {
      const batch = await umdio.courses.list({ gen_ed: tag, per_page: 100, page });
      results.push(...batch);
      if (batch.length < 100) break;
      page++;
    }
    return results;
  }

 export function courseMatchesGenEds(course: Course, input: string): boolean {
    const tags = input.toUpperCase().split(/[\s,]+/).filter(Boolean);
  
    const courseTags = course.gen_ed.flat();
  
    return tags.every(tag => courseTags.includes(tag));
  }

 export async function getCoursesByMultipleGenEds(tags: string): Promise<Course[]> {
    const tagList = tags.toUpperCase().split(/[\s,]+/).filter(Boolean);
    if (tagList.length === 0) return [];
  
    const pool = await getAllCoursesByGenEd(tagList[0]);
    return pool.filter(course => courseMatchesGenEds(course, tags));
  }

export async function getSectionsByCourse(course_id: string, semester: string) {
    try {
        return await getJupSections(course_id, semester);
      } catch {
        return [];  
      }
    }

/** Catalog-style course ids embedded in umd.io prerequisite prose (e.g. CMSC131). */
const COURSE_ID_IN_PREREQ_TEXT = /\b[A-Z]{4}\d{3}\b/g;

function extractPrereqCourseIds(prereqs: string | null | undefined): string[] {
  if (!prereqs) return [];
  const m = prereqs.match(COURSE_ID_IN_PREREQ_TEXT);
  return m ? [...new Set(m)] : [];
}

/**
 * Keeps courses the student is not already finished or taking, and whose parsed
 * prerequisite codes are each in `completedIds` or `inProgressIds`. Codes come
 * from `relationships.prereqs` (best-effort pattern match).
 */
export function removeIneligibleCourses(
  courses: Course[],
  completedIds: string[],
  inProgressIds: string[] = [],
): Course[] {
  const completed = new Set(completedIds);
  const inProgress = new Set(inProgressIds);
  const satisfiesPrereq = new Set([...completedIds, ...inProgressIds]);
  return courses.filter((c) => {
    if (completed.has(c.course_id) || inProgress.has(c.course_id)) return false;
    const needed = extractPrereqCourseIds(c.relationships?.prereqs);
    if (needed.length === 0) return true;
    return needed.every((id) => satisfiesPrereq.has(id));
  });
}

// ─── CS curriculum tiers (advising-style buckets) ─────────────────────────────

const LOWER_LEVEL_IDS = new Set(
  ['CMSC131', 'CMSC132', 'CMSC216', 'CMSC250', 'CMSC330', 'CMSC351'].map((s) =>
    s.toUpperCase(),
  ),
);

/** Upper-level “area” courses + cross-listed equivalents from the major sheet. */
const UPPER_LEVEL_IDS = new Set(
  [
    'CMSC411',
    'CMSC412',
    'CMSC414',
    'CMSC416',
    'CMSC417',
    'CMSC420',
    'CMSC421',
    'CMSC422',
    'CMSC423',
    'CMSC424',
    'CMSC426',
    'CMSC427',
    'CMSC470',
    'CMSC471',
    'CMSC472',
    'CMSC430',
    'CMSC431',
    'CMSC433',
    'CMSC434',
    'CMSC435',
    'CMSC436',
    'CMSC451',
    'CMSC452',
    'CMSC454',
    'CMSC456',
    'CMSC457',
    'CMSC474',
    'CMSC460',
    'CMSC466',
    'MATH456',
    'AMSC460',
    'AMSC466',
  ].map((s) => s.toUpperCase()),
);

export type SortableCSCourse = {
  course_id: string;
  /** If set, length is used as “unlocks” count; otherwise derived from `catalogForUnlocks`. */
  unlocks?: string[];
  profs?: { stars: number; gpa: number }[];
};

export interface SortedCSCourses<T> {
  lower: T[];
  upper: T[];
  electives: T[];
  /** Not lower, upper, or CMSC 300–499 elective bucket (e.g. 1xx/2xx not in lower, 5xx, non-CMSC). */
  other: T[];
}

function normalizeCourseId(id: string): string {
  return id.replace(/\s+/g, '').toUpperCase();
}

function parseDeptNumber(courseId: string): { dept: string; num: number } | null {
  const n = normalizeCourseId(courseId);
  const m = n.match(/^([A-Z]{4})(\d{3})$/);
  if (!m) return null;
  return { dept: m[1], num: Number(m[2]) };
}

/**
 * lower → explicit intro/core list (incl. 330, 351).
 * upper → department upper-level / cross-listed sheet.
 * electives → CMSC 300–499 not in lower or upper (330/351 excluded here via lower).
 */
export function getCSCourseTier(courseId: string): keyof SortedCSCourses<unknown> {
  const id = normalizeCourseId(courseId);
  if (LOWER_LEVEL_IDS.has(id)) return 'lower';
  if (UPPER_LEVEL_IDS.has(id)) return 'upper';
  const p = parseDeptNumber(id);
  if (p?.dept === 'CMSC' && p.num >= 300 && p.num <= 499) return 'electives';
  return 'other';
}

function buildUnlockCounts(prereqSources: Course[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of prereqSources) {
    for (const req of extractPrereqCourseIds(c.relationships?.prereqs)) {
      const key = normalizeCourseId(req);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function avgProfMetrics(profs: SortableCSCourse['profs']): {
  stars: number | null;
  gpa: number | null;
} {
  if (!profs?.length) return { stars: null, gpa: null };
  const withStars = profs.filter((p) => p.stars > 0);
  const withGpa = profs.filter((p) => p.gpa > 0);
  return {
    stars: withStars.length
      ? withStars.reduce((s, p) => s + p.stars, 0) / withStars.length
      : null,
    gpa: withGpa.length
      ? withGpa.reduce((s, p) => s + p.gpa, 0) / withGpa.length
      : null,
  };
}

function unlockSortKey(c: SortableCSCourse, counts: Map<string, number>): number {
  if (c.unlocks !== undefined) return c.unlocks.length;
  return counts.get(normalizeCourseId(c.course_id)) ?? 0;
}

function sortCSCourseTier<T extends SortableCSCourse>(
  items: T[],
  unlockCounts: Map<string, number>,
): T[] {
  return [...items].sort((a, b) => {
    const ua = unlockSortKey(a, unlockCounts);
    const ub = unlockSortKey(b, unlockCounts);
    if (ub !== ua) return ub - ua;
    const ra = avgProfMetrics(a.profs);
    const rb = avgProfMetrics(b.profs);
    const sa = ra.stars ?? -Infinity;
    const sb = rb.stars ?? -Infinity;
    if (sb !== sa) return sb - sa;
    const ga = ra.gpa ?? -Infinity;
    const gb = rb.gpa ?? -Infinity;
    if (gb !== ga) return gb - ga;
    return normalizeCourseId(a.course_id).localeCompare(normalizeCourseId(b.course_id));
  });
}

/**
 * Splits CS-ish courses into lower / upper / electives / other, then sorts each bucket by:
 * 1) how many other courses list this id as a prerequisite (or `unlocks.length` if provided),
 * 2) average professor rating (stars), 3) average GPA. Missing ratings sort after real values.
 *
 * Pass `catalogForUnlocks` (e.g. full CMSC list from the API) so unlock counts reflect the
 * whole catalog, not only the filtered `courses` list.
 */
export function sortCSCourses<T extends SortableCSCourse>(
  courses: T[],
  options?: { catalogForUnlocks?: Course[] },
): SortedCSCourses<T> {
  const catalog = options?.catalogForUnlocks ?? [];
  const unlockSources =
    catalog.length > 0
      ? catalog
      : (courses as unknown as Course[]).filter(
          (c): c is Course =>
            typeof c === 'object' &&
            c != null &&
            'relationships' in c &&
            typeof (c as Course).course_id === 'string',
        );
  const unlockCounts = buildUnlockCounts(unlockSources);

  const buckets: SortedCSCourses<T> = { lower: [], upper: [], electives: [], other: [] };
  for (const c of courses) {
    buckets[getCSCourseTier(c.course_id) as keyof SortedCSCourses<T>].push(c);
  }

  buckets.lower = sortCSCourseTier(buckets.lower, unlockCounts);
  buckets.upper = sortCSCourseTier(buckets.upper, unlockCounts);
  buckets.electives = sortCSCourseTier(buckets.electives, unlockCounts);
  buckets.other = sortCSCourseTier(buckets.other, unlockCounts);

  return buckets;
}

export type SortableGenEdCourse = Course & {
  profs?: { stars: number; gpa: number }[];
};

function normalizeGenEdTagSet(tags: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of tags) {
    for (const part of t.toUpperCase().split(/[\s,]+/).filter(Boolean)) {
      out.add(part);
    }
  }
  return out;
}

/** How many of the still-needed gen-ed labels this course carries. */
export function countGenEdTagsSatisfied(course: Course, missingTags: string[]): number {
  const needed = normalizeGenEdTagSet(missingTags);
  if (needed.size === 0) return 0;
  const offered = (course.gen_ed ?? []).flat().map((x) => x.toUpperCase());
  return offered.filter((tag) => needed.has(tag)).length;
}

/**
 * Orders courses by how many `missingTags` they satisfy (desc), then average
 * professor stars and GPA when `profs` is present on an item. Matches
 * `courseMatchesGenEds`-style tag strings (split on whitespace/commas, uppercase).
 */
export function sortGenEdCourses<T extends Course>(courses: T[], genEdTags: string[]): T[] {
  return [...courses].sort((a, b) => {
    const ca = countGenEdTagsSatisfied(a, genEdTags);
    const cb = countGenEdTagsSatisfied(b, genEdTags);
    if (cb !== ca) return cb - ca;
    const pa =
      'profs' in a && Array.isArray((a as SortableGenEdCourse).profs)
        ? (a as SortableGenEdCourse).profs
        : undefined;
    const pb =
      'profs' in b && Array.isArray((b as SortableGenEdCourse).profs)
        ? (b as SortableGenEdCourse).profs
        : undefined;
    const ra = avgProfMetrics(pa);
    const rb = avgProfMetrics(pb);
    const sa = ra.stars ?? -Infinity;
    const sb = rb.stars ?? -Infinity;
    if (sb !== sa) return sb - sa;
    const ga = ra.gpa ?? -Infinity;
    const gb = rb.gpa ?? -Infinity;
    if (gb !== ga) return gb - ga;
    return normalizeCourseId(a.course_id).localeCompare(normalizeCourseId(b.course_id));
  });
}