const BASE = 'https://api.umd.io/v1';

async function get<T>(path: string, cache: RequestCache = 'force-cache'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache });
  if (!res.ok) throw new Error(`umd.io error ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

export const umdio = {
  courses: {
    list: (params?: { dept_id?: string; semester?: string; gen_ed?: string; credits?: string; page?: number; per_page?: number }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return get<Course[]>(`/courses${q ? `?${q}` : ''}`);
    },
    get: (courseId: string) => get<Course[]>(`/courses/${courseId}`),
    sections: (courseId: string) => get<Section[]>(`/courses/${courseId}/sections`),
    semesters: () => get<string[]>('/courses/semesters'),
    departments: () => get<string[]>('/courses/departments'),
  },
  professors: {
    list: (params?: { name?: string; course_id?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return get<Professor[]>(`/professors${q ? `?${q}` : ''}`);
    },
  },
  bus: {
    routes: () => get<BusRoute[]>('/bus/routes', 'no-store'),
    arrivals: (routeId: string, stopId: string) =>
      get<unknown>(`/bus/routes/${routeId}/arrivals/${stopId}`, 'no-store'),
  },
  map: {
    buildings: () => get<Building[]>('/map/buildings'),
  },
  majors: {
    list: () => get<Major[]>('/majors/list'),
  },
};

export interface Course {
  course_id: string; name: string; dept_id: string; department: string;
  credits: string; description: string; semester: number;
  grading_method: string[]; gen_ed: string[][]; core: string[];
  sections: string[];
  relationships: { prereqs: string | null; coreqs: string | null; restrictions: string | null; formerly: string | null; additional_info: string | null; also_offered_as: string | null; credit_granted_for: string | null; };
}
export interface Section {
  course: string; section_id: string; semester: number;
  number: string; seats: string; open_seats: string; waitlist: string;
  instructors: string[];
  meetings: { days: string; room: string; building: string; classtype: string; start_time: string; end_time: string; }[];
}
export interface Professor { name: string; taught: { semester: number; course: string }[]; }
export interface Building { name: string; code: string; id: string; long: number; lat: number; }
export interface Major { major_id: number; name: string; college: string; url: string; }
export interface BusRoute { route_id: string; title: string; }