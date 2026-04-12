'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { parseAudit } from '@/lib/parseAudit';

export default function AuditUploader() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setError(null);
    setFileName(null);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function runParser(html: string) {
    try {
      setError(null);
      setLoading(true);
      const parsed = parseAudit(html);
      sessionStorage.setItem('auditResult', JSON.stringify(parsed));
      console.log("I AM SHOWERING");
      router.push('/courses');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse audit.');
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const html = await file.text();
    runParser(html);
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Degree Audit Parser</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Upload your UMD degree audit HTML to get personalized course recommendations.
        </p>
      </div>

      <div>
        <label
          htmlFor="audit-file"
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-white px-6 py-10 text-sm text-zinc-500 cursor-pointer hover:border-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {loading ? (
            <span className="font-medium text-zinc-500">Parsing and redirecting...</span>
          ) : fileName ? (
            <span className="font-medium text-zinc-700">{fileName}</span>
          ) : (
            <span>Click to choose your audit <code className="text-xs bg-zinc-100 px-1 py-0.5 rounded">.html</code> file</span>
          )}
        </label>
        <input
          id="audit-file"
          ref={fileInputRef}
          type="file"
          accept=".html,.htm"
          className="sr-only"
          onChange={handleFileChange}
          disabled={loading}
        />
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={reset} className="text-xs text-red-400 hover:text-red-600 shrink-0">Dismiss</button>
        </div>
      )}
    </section>
  );
}
