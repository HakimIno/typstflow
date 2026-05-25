'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { parseCsv, parseXlsx, renderReportToPdf } from '@/lib/typst-wasm';
import { extractSchemaBindings } from '@/lib/utils/binding-extractor';
import { setNestedValue } from '@/lib/utils/json-path';
import { useDesignerStore } from '@/store/designer-store';
import { Icon } from '@iconify/react';
import { clsx } from 'clsx';
import JSZip from 'jszip';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'map' | 'generate' | 'complete';

interface LogEntry {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export const BatchExportModal = memo(function BatchExportModal({
  isOpen,
  onClose,
}: BatchExportModalProps) {
  const schema = useDesignerStore((state) => state.schema);

  const [activeStep, setActiveStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Field mapping state: schemaPath -> csvHeader
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [fileNameHeader, setFileNameHeader] = useState<string>('');

  // Generation progress state
  const [isGenerating, setIsGenerating] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);

  // Timer & remaining state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedSecondsLeft, setEstimatedSecondsLeft] = useState<number | null>(null);

  const generationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cancelGenerationRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 1. Extract all required schema bindings on mount/change
  const schemaBindings = useMemo(() => {
    return extractSchemaBindings(schema);
  }, [schema]);

  // Reset modal state
  const handleReset = useCallback(() => {
    setActiveStep('upload');
    setFile(null);
    setParsedRows([]);
    setHeaders([]);
    setParseError(null);
    setMappings({});
    setFileNameHeader('');
    setIsGenerating(false);
    setCompletedCount(0);
    setSuccessCount(0);
    setErrorCount(0);
    setLogs([]);
    setZipBlob(null);
    setElapsedSeconds(0);
    setEstimatedSecondsLeft(null);
    cancelGenerationRef.current = false;
    if (generationTimerRef.current) {
      clearInterval(generationTimerRef.current);
      generationTimerRef.current = null;
    }
  }, []);

  // Sync state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen, handleReset]);

  // Scroll to bottom of logs on update
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
    // Reference logs to satisfy Biome dependency lint
    const _ = logs.length;
  }, [logs]);

  // Helper to add logs
  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        type,
        message,
        timestamp: time,
      },
    ]);
  }, []);

  // Fuzzy match logic to auto-suggest column mappings
  const runAutoSuggestMappings = useCallback(
    (csvHeaders: string[]) => {
      const suggestions: Record<string, string> = {};
      for (const binding of schemaBindings) {
        // Find direct or fuzzy matching header
        const match = csvHeaders.find((h) => {
          const cleanHeader = h.toLowerCase().replace(/[^a-z0-9]/gi, '');
          const cleanBinding = binding.toLowerCase().replace(/[^a-z0-9]/gi, '');

          return (
            cleanHeader === cleanBinding ||
            cleanBinding.includes(cleanHeader) ||
            cleanHeader.includes(cleanBinding)
          );
        });
        if (match) {
          suggestions[binding] = match;
        } else {
          suggestions[binding] = '';
        }
      }
      setMappings(suggestions);

      // Auto-select filename column
      const idOrNumMatch = csvHeaders.find((h) => {
        const lower = h.toLowerCase();
        return (
          lower.includes('id') ||
          lower.includes('no') ||
          lower.includes('num') ||
          lower.includes('code') ||
          lower.includes('name')
        );
      });
      setFileNameHeader(idOrNumMatch || csvHeaders[0] || '');
    },
    [schemaBindings]
  );

  // File parsing logic
  const handleFile = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setIsParsing(true);
      setParseError(null);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          let data: any[] = [];

          if (selectedFile.name.endsWith('.csv')) {
            const jsonStr = await parseCsv(uint8Array);
            data = JSON.parse(jsonStr);
          } else if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
            const jsonStr = await parseXlsx(uint8Array);
            data = JSON.parse(jsonStr);
          } else if (selectedFile.name.endsWith('.json')) {
            const text = new TextDecoder().decode(uint8Array);
            const parsed = JSON.parse(text);
            data = Array.isArray(parsed) ? parsed : [parsed];
          } else {
            throw new Error('Unsupported file extension. Select CSV, Excel, or JSON.');
          }

          if (data.length === 0) {
            throw new Error('No rows found inside this file.');
          }

          const csvHeaders = Object.keys(data[0] || {});
          setHeaders(csvHeaders);
          setParsedRows(data);
          runAutoSuggestMappings(csvHeaders);
          setActiveStep('map');
        } catch (err: any) {
          console.error('Batch Parser Error:', err);
          setParseError(err.message || String(err));
        } finally {
          setIsParsing(false);
        }
      };
      reader.onerror = () => {
        setParseError('Failed to read file.');
        setIsParsing(false);
      };
      reader.readAsArrayBuffer(selectedFile);
    },
    [runAutoSuggestMappings]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  // Perform sequential browser compiling
  const handleStartGeneration = async () => {
    setIsGenerating(true);
    setActiveStep('generate');
    cancelGenerationRef.current = false;
    setCompletedCount(0);
    setSuccessCount(0);
    setErrorCount(0);
    setLogs([]);
    setZipBlob(null);

    const zip = new JSZip();
    const total = parsedRows.length;
    const startMs = Date.now();

    // Start elapsed timer
    setElapsedSeconds(0);
    generationTimerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    addLog('info', `Starting batch generation for ${total} rows…`);

    for (let i = 0; i < total; i++) {
      if (cancelGenerationRef.current) {
        addLog('info', 'Generation cancelled by user.');
        break;
      }

      const rawRow = parsedRows[i];

      // 1. Build nested record according to column mappings
      let rowRecord: Record<string, any> = {};
      for (const [bindingPath, csvHeader] of Object.entries(mappings)) {
        if (csvHeader) {
          let val = rawRow[csvHeader];
          // Auto-parse string if it looks like a JSON array or object
          if (
            typeof val === 'string' &&
            (val.trim().startsWith('[') || val.trim().startsWith('{'))
          ) {
            try {
              val = JSON.parse(val);
            } catch {
              // Ignore and keep as string
            }
          }
          rowRecord = setNestedValue(rowRecord, bindingPath, val);
        }
      }

      // Reconstruct clean dynamic filename
      const rawFilenameVal = rawRow[fileNameHeader];
      const filename = rawFilenameVal
        ? `${String(rawFilenameVal).replace(/[^a-z0-9_-]/gi, '_')}.pdf`
        : `document_${i + 1}.pdf`;

      addLog('info', `Compiling [${i + 1}/${total}]: ${filename}…`);

      try {
        // Compile directly in-browser using the local WASM worker
        const pdfBytes = await renderReportToPdf(schema, rowRecord);
        zip.file(filename, pdfBytes);

        setSuccessCount((prev) => prev + 1);
        addLog('success', `✓ Successfully compiled ${filename}`);
      } catch (err: any) {
        console.error(`Row ${i + 1} compilation failed:`, err);
        setErrorCount((prev) => prev + 1);
        addLog('error', `✗ Failed to compile ${filename}: ${err.message || err}`);
      }

      const completed = i + 1;
      setCompletedCount(completed);

      // Estimate remaining time
      const elapsed = Date.now() - startMs;
      const averageMsPerRow = elapsed / completed;
      const remainingRows = total - completed;
      setEstimatedSecondsLeft(Math.round((averageMsPerRow * remainingRows) / 1000));
    }

    // Clean up timer
    if (generationTimerRef.current) {
      clearInterval(generationTimerRef.current);
      generationTimerRef.current = null;
    }

    if (cancelGenerationRef.current) {
      setIsGenerating(false);
      setActiveStep('map');
      return;
    }

    // 2. Package into a zip archive
    addLog('info', 'Packaging compiled files into ZIP…');
    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      setZipBlob(blob);
      setActiveStep('complete');
      addLog('success', '✓ Batch compilation complete! ZIP is ready.');
    } catch (err: any) {
      addLog('error', `Failed to generate ZIP archive: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    cancelGenerationRef.current = true;
    setIsGenerating(false);
  };

  const handleDownloadZip = () => {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${schema.name.toLowerCase().replace(/\s+/g, '-')}-batch-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format timer displays
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={isGenerating ? undefined : onClose}
        onKeyDown={(e) => {
          if (!isGenerating && (e.key === 'Enter' || e.key === ' ')) {
            onClose();
          }
        }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Premium Dialog */}
      <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden transition-all duration-300 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:file-stack" className="w-4.5 h-4.5 text-[var(--accent)]" />
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Batch PDF Export
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                Generate multiple custom PDFs in your browser.
              </p>
            </div>
          </div>
          {!isGenerating && (
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 hover:bg-white/5 rounded-md"
            >
              <Icon icon="lucide:x" className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Wizard Steps indicator */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)]/20 shrink-0 text-[10px] font-semibold tracking-wider text-[var(--text-muted)]">
          <div className="flex-1 flex justify-center py-2.5 relative">
            <span
              className={clsx(
                'transition-colors duration-200',
                activeStep === 'upload'
                  ? 'text-[var(--accent)] font-bold'
                  : 'text-[var(--text-muted)]'
              )}
            >
              1. Upload
            </span>
            {activeStep === 'upload' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
            )}
          </div>
          <div className="w-px h-4 bg-[var(--border-subtle)]" />
          <div className="flex-1 flex justify-center py-2.5 relative">
            <span
              className={clsx(
                'transition-colors duration-200',
                activeStep === 'map' ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-muted)]'
              )}
            >
              2. Map Fields
            </span>
            {activeStep === 'map' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
            )}
          </div>
          <div className="w-px h-4 bg-[var(--border-subtle)]" />
          <div className="flex-1 flex justify-center py-2.5 relative">
            <span
              className={clsx(
                'transition-colors duration-200',
                activeStep === 'generate' || activeStep === 'complete'
                  ? 'text-[var(--accent)] font-bold'
                  : 'text-[var(--text-muted)]'
              )}
            >
              3. Generate
            </span>
            {(activeStep === 'generate' || activeStep === 'complete') && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
            )}
          </div>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* STEP 1: UPLOAD DATA */}
          {activeStep === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                tabIndex={0}
                role="button"
                className={clsx(
                  'border border-dashed border-[var(--border-default)] hover:border-[var(--accent)] rounded-lg p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-[var(--bg-app)]/20 hover:bg-[var(--bg-app)]/40',
                  isParsing && 'opacity-50 pointer-events-none'
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-3">
                  {isParsing ? (
                    <div className="w-4 h-4 border-2 border-t-[var(--accent)] border-white/20 rounded-full animate-spin" />
                  ) : (
                    <Icon icon="lucide:upload-cloud" className="w-5 h-5 text-[var(--accent)]" />
                  )}
                </div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                  Drag & Drop Data File
                </h4>
                <p className="text-[11px] text-[var(--text-muted)] max-w-sm mb-4 leading-relaxed">
                  Support CSV, Excel (.xlsx, .xls), or JSON Array files containing your batch
                  records.
                </p>
                <div className="px-3.5 py-1.5 bg-white/5 border border-[var(--border-subtle)] text-[10px] uppercase font-bold tracking-wider rounded-md text-[var(--text-secondary)] hover:bg-white/10 transition-colors">
                  Select File
                </div>
              </div>

              {parseError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3 text-xs text-red-400 items-start">
                  <Icon icon="lucide:alert-circle" className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error Parsing File</span>
                    <p className="mt-0.5 text-[11px] text-red-300/80 leading-relaxed">
                      {parseError}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--text-muted)] py-2">
                <Icon icon="lucide:lock" className="w-3.5 h-3.5 text-green-500" />
                <span>100% Client-Side. Your files never leave your browser.</span>
              </div>
            </div>
          )}

          {/* STEP 2: FIELD MAPPING */}
          {activeStep === 'map' && (
            <div className="space-y-6">
              {/* Loaded Summary */}
              <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-app)]/30 border border-[var(--border-default)] rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium">
                    Loaded{' '}
                    <span className="text-[var(--text-primary)] font-bold">{file?.name}</span> (
                    {parsedRows.length} rows)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[10px] text-[var(--accent)] hover:underline font-medium"
                >
                  Change File
                </button>
              </div>

              {/* Mappings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Map Template Variables
                  </h4>
                </div>

                <div className="border border-[var(--border-default)] rounded-lg overflow-hidden bg-[var(--bg-surface)]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-app)]/50 border-b border-[var(--border-default)] text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        <th className="px-4 py-3">Template Variable</th>
                        <th className="px-4 py-3">Source Column</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schemaBindings.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-4 py-8 text-center text-[var(--text-muted)]"
                          >
                            No data bindings found in your layout schema.
                          </td>
                        </tr>
                      ) : (
                        schemaBindings.map((binding) => (
                          <tr
                            key={binding}
                            className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-app)]/10 transition-colors"
                          >
                            <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-primary)] font-medium">
                              {binding}
                            </td>
                            <td className="px-4 py-2">
                              <Select
                                value={mappings[binding] || '__blank__'}
                                onValueChange={(val) =>
                                  setMappings((prev) => ({
                                    ...prev,
                                    [binding]: val === '__blank__' ? '' : val,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-full h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__blank__">
                                    -- Leave Blank (Use Default/Fallbacks) --
                                  </SelectItem>
                                  {headers.map((h) => (
                                    <SelectItem key={h} value={h}>
                                      {h}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PDF Filename selection */}
              <div className="p-4 bg-[var(--bg-app)]/30 border border-[var(--border-default)] rounded-lg flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:file-text" className="w-4 h-4 text-[var(--text-secondary)]" />
                  <h5 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Output Filename
                  </h5>
                </div>
                <div className="flex gap-4 items-center">
                  <Select value={fileNameHeader} onValueChange={(val) => setFileNameHeader(val)}>
                    <SelectTrigger className="flex-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-[10px] text-[var(--text-muted)] shrink-0 font-mono">
                    Preview:{' '}
                    <span className="text-[var(--text-secondary)] font-medium">
                      {parsedRows[0]?.[fileNameHeader] || 'invoice'}.pdf
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RUN AND COMPILE */}
          {activeStep === 'generate' && (
            <div className="space-y-6 py-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
                  <span className="text-[var(--text-secondary)] font-medium">
                    Generating PDF documents...
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {successCount} Success
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {errorCount} Fail
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 shrink-0">
                <div className="h-1.5 w-full bg-[var(--border-default)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300 rounded-full"
                    style={{ width: `${(completedCount / parsedRows.length) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-[var(--text-muted)]">
                  <span>
                    {completedCount} / {parsedRows.length} files
                  </span>
                  <span>{Math.round((completedCount / parsedRows.length) * 100)}% Complete</span>
                </div>
              </div>

              {/* Timers info */}
              <div className="flex justify-between items-center border border-[var(--border-default)] px-3 py-2 rounded-md text-[10px] text-[var(--text-secondary)] font-mono shrink-0">
                <span>Elapsed: {formatTime(elapsedSeconds)}</span>
                {estimatedSecondsLeft !== null && estimatedSecondsLeft > 0 && (
                  <span>Remaining: ~{formatTime(estimatedSecondsLeft)}</span>
                )}
              </div>

              {/* Real-time Compiler Log Console */}
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Console Logs
                  </span>
                </div>
                <div
                  ref={logContainerRef}
                  className="flex-1 min-h-[160px] max-h-[220px] bg-black/60 border border-[var(--border-default)] rounded-lg p-3.5 overflow-y-auto font-mono text-[10px] space-y-1.5 scrollbar-hide text-[var(--text-secondary)] shrink-0"
                >
                  {logs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
                      Initializing compilation pipeline...
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className={clsx(
                          'flex gap-2 items-start leading-relaxed',
                          log.type === 'success' && 'text-green-400/90',
                          log.type === 'error' && 'text-red-400/90',
                          log.type === 'info' && 'text-slate-400/90'
                        )}
                      >
                        <span className="opacity-40 text-[9px] shrink-0">{log.timestamp}</span>
                        <p className="break-all">{log.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETED PAGE */}
          {activeStep === 'complete' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-5 shrink-0">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
                <Icon icon="lucide:check" className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Batch Generation Complete
                </h4>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
                  Successfully generated{' '}
                  <span className="text-[var(--text-secondary)] font-bold">{successCount}</span> out
                  of {parsedRows.length} documents. All files are bundled into a ZIP archive.
                </p>
              </div>

              {errorCount > 0 && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400 flex items-center gap-2 max-w-sm">
                  <Icon icon="lucide:alert-circle" className="w-3.5 h-3.5 shrink-0" />
                  <span>Warning: {errorCount} rows failed to compile.</span>
                </div>
              )}

              {/* Log Summary Console */}
              <div className="w-full space-y-2 text-left shrink-0">
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Log Summary</span>
                  <span className="font-mono opacity-50">Done in {formatTime(elapsedSeconds)}</span>
                </div>
                <div
                  ref={logContainerRef}
                  className="max-h-28 w-full bg-black/60 border border-[var(--border-default)] rounded-lg p-3 overflow-y-auto font-mono text-[9px] space-y-1 scrollbar-hide shrink-0"
                >
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={clsx(
                        'flex gap-2 items-start',
                        log.type === 'success' && 'text-green-400/80',
                        log.type === 'error' && 'text-red-400/80',
                        log.type === 'info' && 'text-slate-400/80'
                      )}
                    >
                      <span className="opacity-40 text-[9px] shrink-0">{log.timestamp}</span>
                      <p className="break-all">{log.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-4 bg-[var(--bg-app)]/30 border-t border-[var(--border-default)] shrink-0">
          {/* Left indicator or back button */}
          <div>
            {activeStep === 'map' && (
              <button
                type="button"
                onClick={() => setActiveStep('upload')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-md transition-colors"
              >
                <Icon icon="lucide:arrow-left" className="w-3 h-3" />
                Back
              </button>
            )}
            {activeStep === 'upload' && (
              <div className="text-[10px] text-[var(--text-muted)] max-w-[280px] leading-tight flex items-center gap-1.5">
                <Icon icon="lucide:info" className="w-3.5 h-3.5 shrink-0" />
                Headers in CSV should match variables in template.
              </div>
            )}
            {activeStep === 'generate' && (
              <div className="text-[10px] text-[var(--text-muted)] font-mono">
                Compiling in-browser WASM thread...
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {!isGenerating && activeStep !== 'complete' && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-md transition-colors"
              >
                Cancel
              </button>
            )}

            {activeStep === 'map' && (
              <button
                type="button"
                onClick={handleStartGeneration}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent-glow)] rounded-md hover:opacity-90 active:scale-95 transition-all"
              >
                <Icon icon="lucide:play" className="w-3.5 h-3.5" />
                Start Generation
              </button>
            )}

            {isGenerating && activeStep === 'generate' && (
              <button
                type="button"
                onClick={handleCancelGeneration}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white rounded-md hover:bg-red-700 active:scale-95 transition-all shadow-md shrink-0"
              >
                <Icon icon="lucide:pause" className="w-3.5 h-3.5" />
                Cancel Generation
              </button>
            )}

            {activeStep === 'complete' && (
              <>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/5 rounded-md transition-colors"
                >
                  Start Over
                </button>
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="flex items-center gap-1.5 px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-green-600 text-white shadow-md rounded-md hover:bg-green-700 active:scale-95 transition-all"
                >
                  <Icon icon="lucide:download" className="w-3.5 h-3.5" />
                  Download ZIP
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
