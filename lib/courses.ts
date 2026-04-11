import { umdio, Course } from '@/lib/umdio';

export async function getAllCoursesByAttribute(params?: {dept_id?: string; semester?: number; credits?: number; }): Promise<Course[]> {
    const results: Course[] = [];
    let page = 1;
    const MAX_PAGES = 50;
      const query: Record<string, string | number> = { per_page: 100 };
    if (params?.dept_id)  query.dept_id  = params.dept_id;
    if (params?.semester) query.semester = params.semester.toString();
    if (params?.credits)  query.credits  = params.credits.toString();
  
    while (page <= MAX_PAGES) {
      const batch = await umdio.courses.list({ ...query, page });
      results.push(...batch);
      if (batch.length < 100) break;
      page++;
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
  