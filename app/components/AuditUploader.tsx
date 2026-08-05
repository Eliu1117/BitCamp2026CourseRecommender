'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { FileUp, Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

import { parseAudit } from '@/lib/parseAudit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AuditUploader() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pastedHtml, setPastedHtml] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

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
      toast.success('Audit parsed successfully', {
        description: 'Redirecting to your course recommendations…',
      });
      router.push('/courses');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to parse audit.';
      setError(message);
      setLoading(false);
      toast.error('Could not parse audit', { description: message });
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const html = await file.text();
    runParser(html);
  }

  async function handleFile(file: File) {
    if (!/\.html?$/i.test(file.name)) {
      const message = 'Please upload an .html or .htm degree audit file.';
      setError(message);
      toast.error('Unsupported file type', { description: message });
      return;
    }
    setFileName(file.name);
    const html = await file.text();
    runParser(html);
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (loading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) await handleFile(file);
    },
    [loading],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  function handlePasteSubmit() {
    if (!pastedHtml.trim()) {
      const message = 'Paste your degree audit HTML before continuing.';
      setError(message);
      toast.error('Nothing to parse', { description: message });
      return;
    }
    runParser(pastedHtml);
  }

  return (
    <Card className="border-dashed-none">
      <CardHeader>
        <CardTitle className="text-xl">Degree Audit Parser</CardTitle>
        <CardDescription>
          Upload your UMD degree audit HTML to get personalized, prerequisite-aware course
          recommendations with live seat data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="paste">Paste HTML</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="pt-3">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
            >
              <label
                htmlFor="audit-file"
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-sm transition-colors ${
                  loading
                    ? 'cursor-not-allowed border-border bg-muted/40 text-muted-foreground'
                    : isDragging
                      ? 'cursor-pointer border-primary bg-primary/5 text-foreground'
                      : 'cursor-pointer border-border bg-muted/20 text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <Loader2 className="size-8 animate-spin" aria-hidden="true" />
                      <span className="font-medium">Parsing and redirecting…</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={isDragging ? 'dragging' : fileName ?? 'idle'}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex flex-col items-center gap-2"
                    >
                      {isDragging ? (
                        <>
                          <UploadCloud className="size-8" aria-hidden="true" />
                          <span className="font-medium">Drop your audit file here</span>
                        </>
                      ) : fileName ? (
                        <>
                          <FileUp className="size-8" aria-hidden="true" />
                          <span className="font-medium text-foreground">{fileName}</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="size-8" aria-hidden="true" />
                          <span>
                            Drag &amp; drop, or click to choose your audit{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">.html</code>{' '}
                            file
                          </span>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </label>
              <input
                id="audit-file"
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                className="sr-only"
                onChange={handleFileChange}
                disabled={loading}
                aria-describedby={error ? 'audit-uploader-error' : undefined}
              />
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-3 pt-3">
            <Textarea
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
              placeholder="Paste the raw HTML of your uAchieve degree audit here…"
              rows={8}
              disabled={loading}
              className="font-mono text-xs"
              aria-label="Pasted degree audit HTML"
            />
            <Button onClick={handlePasteSubmit} disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Parsing…
                </>
              ) : (
                'Parse pasted audit'
              )}
            </Button>
          </TabsContent>
        </Tabs>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert variant="destructive" id="audit-uploader-error">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>
                  {error}
                  <div className="mt-2">
                    <Button variant="outline" size="sm" onClick={reset}>
                      Dismiss
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
