import { FileSearch2, ListChecks, Radar } from 'lucide-react';

import AuditUploader from '@/app/components/AuditUploader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FEATURES = [
  {
    icon: FileSearch2,
    title: 'Custom DOM audit parser',
    description:
      "Parses UMD's uAchieve HTML export directly in your browser — no data ever leaves your machine.",
  },
  {
    icon: Radar,
    title: 'Real-time seat & section data',
    description:
      'Cross-references live JupiterP section data so you only see courses with open seats this term.',
  },
  {
    icon: ListChecks,
    title: 'Prerequisite-aware recommendations',
    description:
      'Filters out courses you can\'t take yet and ranks the rest by what they unlock next.',
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="animate-in fade-in slide-in-from-bottom-2 mb-10 space-y-3 text-center duration-700 sm:mb-14">
        <p className="text-sm font-medium text-muted-foreground">Better Jupiterp</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Turn your degree audit into a course plan in seconds.
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Upload your UMD uAchieve degree audit and get personalized, prerequisite-aware course
          recommendations with live seat and section data — built for Computer Science majors.
        </p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 mb-8 grid gap-4 delay-100 duration-700 sm:grid-cols-3 sm:mb-12">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title} size="sm">
            <CardHeader>
              <Icon className="mb-1 size-5 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 delay-200 duration-700">
        <AuditUploader />
      </div>
    </main>
  );
}
