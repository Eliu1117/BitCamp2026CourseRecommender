import { umdio } from '@/lib/umdio';
import AuditUploader from '@/app/components/AuditUploader';
import { getAllCoursesByAttribute, getAllCoursesByGenEd, getCoursesByMultipleGenEds} from '@/lib/courses';

export default async function Home() {

  const [cmsccourses, scisdshu, dssp] = await Promise.all([
    getAllCoursesByAttribute({ dept_id: 'CMSC' }),
    getCoursesByMultipleGenEds('SCIS DSHU'),
    getAllCoursesByGenEd('DSSP'),
  ]);

  return (

    <main className="px-6 py-12 space-y-10">
      <h1 className="text-4xl font-bold">Better Jupiterp</h1>
      <AuditUploader />
      <div className="grid grid-cols-3 gap-8">
        <CourseList title="All CS Courses" courses={cmsccourses} />
        <CourseList title="SCIS and DSHU Courses" courses={scisdshu} />
        <CourseList title="DSSP Courses" courses={dssp} />
      </div>
    </main>
  );
}

function CourseList({ title, courses }: { title: string; courses: Awaited<ReturnType<typeof getAllCoursesByAttribute>> }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">{title}</h1>
      <ul className="space-y-3">
        {courses.map((course) => (
          <li key={course.course_id} className="rounded-lg border p-4">
            <p className="font-mono text-sm text-zinc-500">{course.course_id}</p>
            <p className="font-medium">{course.name}</p>
            <p className="text-sm text-zinc-400">{course.credits} cr · {course.department}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
