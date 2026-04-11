'use client';

import { useState, useRef } from 'react';
import { parseAudit, type AuditResult } from '@/lib/parseAudit';

type Tab = 'upload';

export default function AuditUploader() {
  const [tab, setTab] = useState<Tab>('upload');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setResult(null);
    setError(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function runParser(html: string) {
    try {
      setError(null);
      setResult(parseAudit(html));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse audit.');
      setResult(null);
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
          Upload the HTML of your UMD degree audit to extract a structured summary.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200">
        {(['upload'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); reset(); }}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-zinc-800 text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {'Upload File'}
          </button>
        ))}
      </div>

      {/* Upload */}
      {tab === 'upload' && (
        <div>
          <label
            htmlFor="audit-file"
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-white px-6 py-10 text-sm text-zinc-500 cursor-pointer hover:border-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            {fileName ? (
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
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700">Parsed Result</h3>
            <button
              onClick={reset}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Student" value={result.student.name ?? '—'} />
            <StatCard label="Credits Earned" value={result.credits.earned?.toString() ?? '—'} />
            <StatCard label="In Progress" value={result.credits.in_progress?.toString() ?? '—'} />
            <StatCard label="Still Needed" value={result.credits.still_needed?.toString() ?? '—'} />
          </div>

          {/* Full JSON */}
          <details className="rounded-lg border border-zinc-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-600 hover:text-zinc-800 select-none">
              Full JSON output
            </summary>
            <pre className="overflow-x-auto px-4 pb-4 text-xs text-zinc-700 leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-zinc-800 truncate">{value}</p>
    </div>
  );
}
