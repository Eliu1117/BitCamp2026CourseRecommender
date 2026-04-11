import AuditUploader from '@/app/components/AuditUploader';
import { getAllCoursesByAttribute, getAllCoursesByGenEd, getCoursesByMultipleGenEds, getSectionsByCourse, CURRENTSEM} from '@/lib/courses';

export default async function Home() {
  // const [cmsccourses, scisdshu, dssp] = await Promise.all([
  //   getAllCoursesByAttribute({ dept_id: 'CMSC', credits: 4}),
  //   getCoursesByMultipleGenEds('SCIS DSHU'),
  //   getAllCoursesByGenEd('DSSP'),
  // ]);

  return (

    <main className="px-6 py-12 space-y-10">
      <AuditUploader />
      {/* <div className="grid grid-cols-3 gap-8">
        <SectionList title="4 Credit CS Courses" courses={cmsccourses} />
        <SectionList title="SCIS and DSHU Courses" courses={scisdshu} />
        <SectionList title="DSSP Courses" courses={dssp} />
      </div> */}
    </main>
  );
}

// async function CourseCard({ course }: { course: Awaited<ReturnType<typeof getAllCoursesByAttribute>>[number] }) {  
//   const sections = await getSectionsByCourse(course.course_id, CURRENTSEM)
//   return (
//     <li className="rounded-lg border p-4 space-y-2">
//       <p className="font-mono text-sm text-zinc-500">{course.course_id}</p>
//       <p className="font-medium">{course.name}</p>
//       <p className="text-sm text-zinc-400">{course.credits} cr · {course.department}</p>

//       <div className="space-y-1 pt-1">
//         {sections.map(section => (
//           <div key={section.sec_code} className="text-sm flex justify-between">
//             <span className="font-mono">{section.sec_code}</span>
//             <span className="text-zinc-800">{section.instructors.join(', ')}</span>
//             <span className={(section.open_seats) > 0 ? 'text-green-600' : 'text-red-500'}>
//               {section.open_seats}/{section.total_seats} open
//             </span>

//             <div className="space-y-0.5 text-zinc-800">
//             {section.meetings.map((m, i) => {
//               const { days, start, end, building, room } = parseMeeting(m);
//               return (
//                 <div key={i}>
//                   {days} {start}–{end} · {building} {room}
//                 </div>
//               );
//             })}
//           </div>
//           </div>

          
//         ))}
//       </div>
//     </li>
//   );
// }

// function SectionList({ title, courses }: { title: string; courses: Awaited<ReturnType<typeof getAllCoursesByAttribute>> }) {
//   return (
//     <div>
//       <h1 className="text-2xl font-semibold mb-4">{title}</h1>
//       <ul className="space-y-3">
//         {courses.map(course => (
//           <CourseCard key={course.course_id} course={course} />
//         ))}
//       </ul>
//     </div>
//   );
// }

// function parseMeeting(m: string) {
//   const [days, start, end, building, room] = m.split('-');
//   return { days, start, end, building, room };
// }

