import { umdio } from '@/lib/umdio';

export default async function Home() {
  const [courses, departments] = await Promise.all([
    umdio.courses.list({ dept_id: 'CMSC', per_page: 10 }),
    umdio.courses.departments(),
  ]);

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">CMSC Courses</h1>
      <ul className="space-y-3">
        {courses.map((course) => (
          <li key={course.course_id} className="rounded-lg border p-4">
            <p className="font-mono text-sm text-zinc-500">{course.course_id}</p>
            <p className="font-medium">{course.name}</p>
            <p className="text-sm text-zinc-400">{course.credits} cr · {course.department}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}