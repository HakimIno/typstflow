'use client';

import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal';
import { removeBackground } from '@/lib/typst-wasm';
import {
  Check,
  Circle,
  Download,
  Loader2,
  Maximize,
  Pencil,
  RotateCcw,
  Scissors,
  Sparkles,
  Square,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SegmentedControl, ToggleChip, ToggleChipGroup } from './Shared';

type BrushShape = 'circle' | 'square';
type EditMode = 'manual' | 'auto' | 'ai';

interface BackgroundRemovalModalProps {
  srcData: string;
  onApply: (newSrcData: string) => void;
  onClose: () => void;
}

export function BackgroundRemovalModal({ srcData, onApply, onClose }: BackgroundRemovalModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);

  const [mode, setMode] = useState<EditMode>('manual');
  const [brushShape, setBrushShape] = useState<BrushShape>('circle');
  const [brushSize, setBrushSize] = useState(20);
  const [tolerance, setTolerance] = useState(30);
  const [removing, setRemoving] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [aiPhase, setAiPhase] = useState<'idle' | 'downloading' | 'inferencing'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);

  const modeRef = useRef<EditMode>('manual');
  const brushSizeRef = useRef(brushSize);
  const brushShapeRef = useRef(brushShape);
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);
  const isDrawingRef = useRef(false);
  const pendingPts = useRef<Array<{ x: number; y: number; half: number }>>([]);
  const rafIdRef = useRef<number | null>(null);

  // View transform — refs for hot path, label updated via DOM
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // Pan interaction
  const isSpaceDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // Cached drag context — set on mousedown, reused per RAF tick (avoids reflow in loop)
  const dragRectRef = useRef<{ left: number; top: number; sx: number; sy: number } | null>(null);

  // Cached 2D context + viewport rect — avoid getContext / getBoundingClientRect in hot path
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const viewportRectRef = useRef<{ left: number; top: number; w: number; h: number } | null>(null);
  const cursorVisibleRef = useRef(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);
  useEffect(() => {
    brushShapeRef.current = brushShape;
  }, [brushShape]);

  // Sync cursor overlay visual to current brush
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;
    el.style.width = `${brushSize}px`;
    el.style.height = `${brushSize}px`;
    el.style.borderRadius = brushShape === 'circle' ? '50%' : '2px';
  }, [brushSize, brushShape]);

  const applyTransform = useCallback(() => {
    const w = wrapperRef.current;
    if (w) {
      w.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${scaleRef.current})`;
    }
    const z = zoomLabelRef.current;
    if (z) z.textContent = `${Math.round(scaleRef.current * 100)}%`;
  }, []);

  const resetView = useCallback(() => {
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    applyTransform();
  }, [applyTransform]);

  const setViewportCursor = useCallback(() => {
    const v = viewportRef.current;
    if (!v) return;
    if (isPanningRef.current) v.style.cursor = 'grabbing';
    else if (isSpaceDownRef.current) v.style.cursor = 'grab';
    else if (modeRef.current === 'manual') v.style.cursor = 'none';
    else v.style.cursor = 'default';
  }, []);

  useEffect(() => {
    setViewportCursor();
  }, [mode, setViewportCursor]);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (trimmed.length >= 30) trimmed.shift();
    historyRef.current = [...trimmed, imageData];
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
  }, []);

  // Load image onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctxRef.current = ctx;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      historyRef.current = [];
      historyIndexRef.current = -1;
      setCanUndo(false);
      pushHistory();
      resetView();
    };
    img.src = srcData;
  }, [srcData, pushHistory, resetView]);

  // Cache viewport rect — refresh on resize/scroll only, not per mousemove
  useEffect(() => {
    const refresh = () => {
      const v = viewportRef.current;
      if (!v) return;
      const r = v.getBoundingClientRect();
      viewportRectRef.current = { left: r.left, top: r.top, w: r.width, h: r.height };
    };
    refresh();
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
    setCanUndo(historyIndexRef.current > 0);
  }, []);

  const undoRef = useRef(undo);
  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);

  // Mouse / touch / wheel / keyboard
  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;

    // Single-point erase (used for mousedown initial mark) — uses cached ctx, no save/restore loop
    const eraseSinglePoint = (cx: number, cy: number, half: number) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      if (brushShapeRef.current === 'circle') {
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
      } else {
        ctx.rect(cx - half, cy - half, half * 2, half * 2);
      }
      ctx.fill();
      ctx.globalCompositeOperation = prev;
    };

    // Batch many points per RAF tick — set composite mode ONCE for the whole batch
    const flushPoints = () => {
      rafIdRef.current = null;
      const drag = dragRectRef.current;
      const ctx = ctxRef.current;
      if (!drag || !ctx) return;
      const pts = pendingPts.current;
      if (pts.length === 0) return;
      const isCircle = brushShapeRef.current === 'circle';
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        const cx = pt.x * drag.sx;
        const cy = pt.y * drag.sy;
        if (isCircle) {
          ctx.moveTo(cx + pt.half, cy);
          ctx.arc(cx, cy, pt.half, 0, Math.PI * 2);
        } else {
          ctx.rect(cx - pt.half, cy - pt.half, pt.half * 2, pt.half * 2);
        }
      }
      ctx.fill();
      ctx.globalCompositeOperation = prev;
      pts.length = 0;
    };

    const scheduleFlush = () => {
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flushPoints);
      }
    };

    const hideCursor = () => {
      if (cursorVisibleRef.current) {
        cursorVisibleRef.current = false;
        const el = cursorRef.current;
        if (el) el.style.display = 'none';
      }
    };

    const updateCursor = (clientX: number, clientY: number) => {
      const el = cursorRef.current;
      if (!el) return;
      if (modeRef.current !== 'manual' || isPanningRef.current || isSpaceDownRef.current) {
        hideCursor();
        return;
      }
      const r = viewportRectRef.current;
      if (!r) return;
      // Hide when outside viewport (cursor is position:fixed at viewport coords)
      if (
        clientX < r.left ||
        clientX > r.left + r.w ||
        clientY < r.top ||
        clientY > r.top + r.h
      ) {
        hideCursor();
        return;
      }
      if (!cursorVisibleRef.current) {
        cursorVisibleRef.current = true;
        el.style.display = 'block';
      }
      // position:fixed at clientX/Y → no viewport-rect arithmetic, pure GPU composite
      el.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
    };

    const startDraw = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      dragRectRef.current = { left: rect.left, top: rect.top, sx, sy };
      isDrawingRef.current = true;
      const half = (brushSizeRef.current / 2) * Math.min(sx, sy);
      eraseSinglePoint((clientX - rect.left) * sx, (clientY - rect.top) * sy, half);
    };

    const continueDraw = (clientX: number, clientY: number) => {
      const drag = dragRectRef.current;
      if (!drag) return;
      const half = (brushSizeRef.current / 2) * Math.min(drag.sx, drag.sy);
      pendingPts.current.push({
        x: clientX - drag.left,
        y: clientY - drag.top,
        half,
      });
      scheduleFlush();
    };

    const finishDraw = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        flushPoints();
      }
      dragRectRef.current = null;
      pushHistory();
    };

    const startPan = (clientX: number, clientY: number) => {
      isPanningRef.current = true;
      panStartRef.current = {
        mx: clientX,
        my: clientY,
        px: panRef.current.x,
        py: panRef.current.y,
      };
      setViewportCursor();
      hideCursor();
    };

    const continuePan = (clientX: number, clientY: number) => {
      const start = panStartRef.current;
      if (!start) return;
      panRef.current = {
        x: start.px + (clientX - start.mx),
        y: start.py + (clientY - start.my),
      };
      applyTransform();
    };

    const finishPan = () => {
      if (!isPanningRef.current) return;
      isPanningRef.current = false;
      panStartRef.current = null;
      setViewportCursor();
    };

    const onMouseDown = (e: MouseEvent) => {
      const isPanTrigger = isSpaceDownRef.current || e.button === 1;
      if (isPanTrigger) {
        e.preventDefault();
        startPan(e.clientX, e.clientY);
        return;
      }
      if (e.button !== 0 || modeRef.current !== 'manual') return;
      const rect = canvas.getBoundingClientRect();
      const inCanvas =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inCanvas) return;
      e.preventDefault();
      startDraw(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        continuePan(e.clientX, e.clientY);
        updateCursor(e.clientX, e.clientY);
        return;
      }
      updateCursor(e.clientX, e.clientY);
      if (isDrawingRef.current) {
        continueDraw(e.clientX, e.clientY);
      }
    };

    const onMouseUp = () => {
      if (isPanningRef.current) {
        finishPan();
        return;
      }
      finishDraw();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cRect = canvas.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newScale = Math.max(0.1, Math.min(10, scaleRef.current * factor));
      const ratio = newScale / scaleRef.current;
      panRef.current = {
        x: panRef.current.x + (e.clientX - cRect.left) * (1 - ratio),
        y: panRef.current.y + (e.clientY - cRect.top) * (1 - ratio),
      };
      scaleRef.current = newScale;
      applyTransform();
    };

    const onMouseLeaveViewport = () => hideCursor();

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.code === 'Space' && !isSpaceDownRef.current && !inField) {
        e.preventDefault();
        isSpaceDownRef.current = true;
        if (!isPanningRef.current) setViewportCursor();
        hideCursor();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoRef.current?.();
      }
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        resetView();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDownRef.current = false;
        if (!isPanningRef.current) setViewportCursor();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (modeRef.current !== 'manual') return;
      e.preventDefault();
      const t = e.touches[0];
      startDraw(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const t = e.touches[0];
      continueDraw(t.clientX, t.clientY);
    };
    const onTouchEnd = () => finishDraw();

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('mousedown', onMouseDown);
    viewport.addEventListener('mouseleave', onMouseLeaveViewport);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('mousedown', onMouseDown);
      viewport.removeEventListener('mouseleave', onMouseLeaveViewport);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [pushHistory, applyTransform, resetView, setViewportCursor]);

  const handleAutoRemove = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRemoving(true);
    try {
      // Downscale very large images so flood-fill + PNG encode stay snappy.
      // Result is upscaled back to the original canvas size after WASM returns.
      const MAX_DIM = 1600;
      const longestEdge = Math.max(canvas.width, canvas.height);
      let processSrc: HTMLCanvasElement = canvas;
      let scaledDown = false;
      if (longestEdge > MAX_DIM) {
        const ratio = MAX_DIM / longestEdge;
        const dw = Math.round(canvas.width * ratio);
        const dh = Math.round(canvas.height * ratio);
        const tmp = document.createElement('canvas');
        tmp.width = dw;
        tmp.height = dh;
        const tctx = tmp.getContext('2d');
        if (!tctx) throw new Error('temp canvas ctx failed');
        tctx.imageSmoothingQuality = 'high';
        tctx.drawImage(canvas, 0, 0, dw, dh);
        processSrc = tmp;
        scaledDown = true;
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        processSrc.toBlob(resolve, 'image/png')
      );
      if (!blob) throw new Error('canvas blob failed');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const resultDataUrl = await removeBackground(bytes, tolerance);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('load failed'));
        img.src = resultDataUrl;
      });

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (scaledDown) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      pushHistory();
    } catch (err) {
      console.error('[BgRemoval] auto remove failed:', err);
    } finally {
      setRemoving(false);
    }
  }, [tolerance, pushHistory]);

  const handleAiRemove = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRemoving(true);
    setAiError(null);
    try {
      // 1. Snapshot canvas → Blob
      const sourceBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!sourceBlob) throw new Error('canvas blob failed');

      // 2. Run imgly — uses WebGPU when available, falls back to WASM SIMD threads.
      //    Enforce a 3s minimum so the shimmer animation always gets a moment to shine,
      //    even when WebGPU finishes inference in 0.5-1s.
      setAiPhase('downloading');
      const MIN_DURATION_MS = 3000;
      const startedAt = performance.now();
      const inferencePromise = imglyRemoveBackground(sourceBlob, {
        device: 'gpu',
        model: 'isnet_fp16',
        output: { format: 'image/png' },
        progress: (key: string, current: number, total: number) => {
          if (key.startsWith('fetch')) {
            setAiPhase('downloading');
            setAiProgress({ loaded: current, total });
          } else {
            setAiPhase('inferencing');
            setAiProgress(null);
          }
        },
      });
      const [resultBlob] = await Promise.all([
        inferencePromise,
        new Promise<void>((resolve) => {
          inferencePromise.finally(() => {
            const elapsed = performance.now() - startedAt;
            const remaining = Math.max(0, MIN_DURATION_MS - elapsed);
            setTimeout(resolve, remaining);
          });
        }),
      ]);

      // 3. Draw result back onto canvas
      const url = URL.createObjectURL(resultBlob);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('result decode failed'));
          img.src = url;
        });
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        pushHistory();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[BgRemoval] AI remove failed:', err);
      setAiError(msg);
    } finally {
      setRemoving(false);
      setAiPhase('idle');
      setAiProgress(null);
    }
  }, [pushHistory]);

  const handleApply = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onApply(canvas.toDataURL('image/png'));
    onClose();
  }, [onApply, onClose]);

  const modeOptions = [
    { value: 'manual' as EditMode, label: 'Manual', icon: Pencil },
    { value: 'auto' as EditMode, label: 'Auto', icon: Zap },
    { value: 'ai' as EditMode, label: 'AI', icon: Sparkles },
  ];

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="relative w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden flex"
        style={{ height: '85vh' }}
      >
        {/* ── Sidebar ── */}
        <div className="w-56 shrink-0 flex flex-col border-r border-[var(--border-default)]">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-default)] bg-[var(--bg-app)]/30 shrink-0">
            <div className="flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Background
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Mode
              </p>
              <SegmentedControl options={modeOptions} value={mode} onChange={setMode} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  Zoom
                </p>
                <span
                  ref={zoomLabelRef}
                  className="text-[9px] font-mono text-[var(--text-secondary)]"
                >
                  100%
                </span>
              </div>
              <button
                type="button"
                onClick={resetView}
                className="w-full flex items-center justify-center gap-1.5 h-6 border border-[var(--border-default)] rounded-[3px] text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)] hover:bg-white/[0.04] transition-all"
              >
                <Maximize className="w-3 h-3" />
                Fit
              </button>
              <p className="text-[8px] text-[var(--text-muted)] leading-relaxed">
                Wheel = zoom · Space + drag = pan · ⌘0 = reset
              </p>
            </div>

            {mode === 'manual' && (
              <>
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Eraser Shape
                  </p>
                  <ToggleChipGroup>
                    <ToggleChip
                      checked={brushShape === 'circle'}
                      onChange={() => setBrushShape('circle')}
                      label="Circle"
                      icon={Circle}
                    />
                    <ToggleChip
                      checked={brushShape === 'square'}
                      onChange={() => setBrushShape('square')}
                      label="Square"
                      icon={Square}
                    />
                  </ToggleChipGroup>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      Size
                    </p>
                    <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                      {brushSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={150}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-1 accent-[var(--accent)] cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={undo}
                  disabled={!canUndo}
                  className="w-full flex items-center justify-center gap-1.5 h-6 border border-[var(--border-default)] rounded-[3px] text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)] hover:bg-white/[0.04] disabled:opacity-40 transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  Undo
                </button>

                <p className="text-[8px] text-[var(--text-muted)] leading-relaxed">
                  Paint over areas to erase. Use Auto mode to remove background colour from corners.
                </p>
              </>
            )}

            {mode === 'auto' && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      Tolerance
                    </p>
                    <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                      {tolerance}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={120}
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full h-1 accent-[var(--accent)] cursor-pointer"
                  />
                  <p className="text-[8px] text-[var(--text-muted)]">
                    Higher = more aggressive removal
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAutoRemove}
                  disabled={removing}
                  className="w-full flex items-center justify-center gap-1.5 h-7 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 text-white text-[9px] font-bold uppercase tracking-wide rounded-[3px] transition-all"
                >
                  {removing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Scissors className="w-3.5 h-3.5" />
                  )}
                  {removing ? 'Removing…' : 'Remove Background'}
                </button>

                <p className="text-[8px] text-[var(--text-muted)] leading-relaxed">
                  Rust WASM flood-fill from corners. Combine with Manual mode for touch-ups.
                </p>
              </>
            )}

            {mode === 'ai' && (
              <>
                <p className="text-[8px] text-[var(--text-muted)] leading-relaxed">
                  ISNet salient-object segmentation. Detects subjects automatically — works
                  on people, products, animals. Uses WebGPU when available.
                </p>

                {aiPhase === 'downloading' && aiProgress && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Downloading model
                      </p>
                      <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                        {aiProgress.total
                          ? `${Math.round((aiProgress.loaded / aiProgress.total) * 100)}%`
                          : `${(aiProgress.loaded / 1024 / 1024).toFixed(1)} MB`}
                      </span>
                    </div>
                    <div className="h-1 bg-white/[0.06] rounded overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all"
                        style={{
                          width: aiProgress.total
                            ? `${(aiProgress.loaded / aiProgress.total) * 100}%`
                            : '50%',
                        }}
                      />
                    </div>
                  </div>
                )}

                {aiPhase === 'inferencing' && (
                  <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-secondary)]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Running inference… (0.5-3s)
                  </div>
                )}

                {aiError && (
                  <div className="text-[8px] text-red-400 leading-relaxed border border-red-400/20 bg-red-400/[0.04] rounded p-1.5">
                    {aiError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAiRemove}
                  disabled={removing}
                  className="w-full flex items-center justify-center gap-1.5 h-7 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 text-white text-[9px] font-bold uppercase tracking-wide rounded-[3px] transition-all"
                >
                  {removing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : aiPhase === 'idle' ? (
                    <Sparkles className="w-3.5 h-3.5" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {removing ? 'Processing…' : 'Smart Extract'}
                </button>

                <p className="text-[8px] text-[var(--text-muted)] leading-relaxed">
                  First use downloads the model (~80MB, cached after). WebGPU accelerated.
                  Use Manual mode to clean up edges if needed.
                </p>
              </>
            )}
          </div>

          <div className="flex gap-2 p-3 border-t border-[var(--border-default)] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-7 border border-[var(--border-default)] rounded-[3px] text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:bg-white/[0.04] transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 h-7 flex items-center justify-center gap-1 bg-[var(--accent)] hover:bg-[var(--accent)]/90 rounded-[3px] text-[9px] font-bold uppercase tracking-wide text-white transition-all"
            >
              <Check className="w-3 h-3" />
              Apply
            </button>
          </div>
        </div>

        {/* ── Canvas area ── */}
        <div
          ref={viewportRef}
          className="flex-1 relative overflow-hidden flex items-center justify-center"
          style={{
            backgroundImage:
              'linear-gradient(45deg,#2a2a2a 25%,transparent 25%),linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2a 75%),linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
            backgroundColor: '#1e1e1e',
            touchAction: 'none',
          }}
        >
          <div
            ref={wrapperRef}
            className="relative"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              lineHeight: 0,
              transformOrigin: '0 0',
              willChange: 'transform',
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'block',
                userSelect: 'none',
              }}
            />
            {/* AI shimmer overlay — Apple "Lift Subject" style, visible during AI processing */}
            {removing && mode === 'ai' && <div className="ai-scan-overlay" />}
          </div>
        </div>
      </div>

      {/* Cursor overlay — root-level fixed, isolated from modal stacking context for GPU promotion */}
      <div
        ref={cursorRef}
        className="pointer-events-none border border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
        style={{
          position: 'fixed',
          display: 'none',
          width: brushSize,
          height: brushSize,
          borderRadius: brushShape === 'circle' ? '50%' : '2px',
          left: 0,
          top: 0,
          zIndex: 101,
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0) translate(-50%, -50%)',
          contain: 'layout style paint',
        }}
      />
    </div>
  );

  return createPortal(modal, document.body);
}
