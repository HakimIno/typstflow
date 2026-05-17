'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';

interface CanvasToolbarProps {
  mode?: 'design' | 'preview';
  activePage?: number; // 1-based index
  totalPageCount?: number;
  onPageChange?: (idx: number) => void;
}

export const CanvasToolbar = memo(function CanvasToolbar({
  mode = 'design',
  activePage: customActivePage,
  totalPageCount: customTotalPageCount,
  onPageChange,
}: CanvasToolbarProps) {
  const zoom = useDesignerStore((state) => state.zoom);
  const setZoom = useDesignerStore((state) => state.setZoom);
  const pageSize = useDesignerStore((state) => state.schema.page.size);
  const pageOrientation = useDesignerStore((state) => state.schema.page.orientation);
  const pages = useDesignerStore((state) => state.schema.pages);
  const activePageId = useDesignerStore((state) => state.activePageId);
  const setScrollToPageId = useDesignerStore((state) => state.setScrollToPageId);

  const pageIds = useMemo(() => pages.map((p) => p.id), [pages]);

  const [currentPageInput, setCurrentPageInput] = useState('1');
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const displayActivePage = customActivePage ?? pageIds.indexOf(activePageId || '') + 1;
  const displayTotalPages = customTotalPageCount ?? pageIds.length;

  useEffect(() => {
    setCurrentPageInput(displayActivePage.toString());
    // Also show toolbar when page changes
    setIsVisible(true);
    const timer = setTimeout(() => setIsVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [displayActivePage]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleScroll = () => {
      setIsVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setIsVisible(false), 2000);
    };

    // Use a small delay to find containers after they are mounted
    const timeout = setTimeout(() => {
      const containers = document.querySelectorAll('[data-canvas-scroll-container]');
      containers.forEach((c) => c.addEventListener('scroll', handleScroll));
    }, 500);

    return () => {
      clearTimeout(timeout);
      clearTimeout(timer);
      const containers = document.querySelectorAll('[data-canvas-scroll-container]');
      containers.forEach((c) => c.removeEventListener('scroll', handleScroll));
    };
  }, []);

  const handleZoomIn = () => setZoom(Math.min(4, zoom + 0.1));
  const handleZoomOut = () => setZoom(Math.max(0.1, zoom - 0.1));
  const handleResetZoom = () => setZoom(1);

  const handleFitToWidth = () => {
    const container =
      mode === 'preview'
        ? document.querySelector('.PreviewPane [data-canvas-scroll-container]')
        : document.querySelector('.Canvas [data-canvas-scroll-container]') ||
          document.querySelector('[data-canvas-scroll-container]');

    if (!container) return;

    // Account for padding (pl-16 pr-16 = 128px)
    const containerWidth = container.clientWidth - 140;
    const { width: pageWidthMm } = getPaperDimensions(pageSize, pageOrientation);
    const pageWidthPx = LayoutEngine.mmToPx(pageWidthMm);

    const targetZoom = containerWidth / pageWidthPx;
    setZoom(Math.min(2, Math.max(0.1, targetZoom)));
  };

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const idx = Number.parseInt(currentPageInput) - 1;
    if (idx >= 0 && idx < displayTotalPages) {
      if (onPageChange) {
        onPageChange(idx);
      } else if (mode === 'design') {
        setScrollToPageId(pageIds[idx]);
      }
    } else {
      setCurrentPageInput(displayActivePage.toString());
    }
  };

  const ButtonToolbar = ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
  }) => {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={clsx(
          'p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-950 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer',
          className
        )}
      >
        {children}
      </button>
    );
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={clsx(
        'absolute bottom-4 left-[30rem] -translate-x-1/2 z-50 flex flex-col items-center p-4'
      )}
    >
      <motion.div
        layout
        initial={false}
        animate={{
          width: isVisible || isHovered ? 'auto' : 40,
          height: isVisible || isHovered ? 42 : 4,
          borderRadius: isVisible || isHovered ? 24 : 2,
          y: isVisible || isHovered ? 0 : 8,
          backgroundColor:
            isVisible || isHovered ? 'rgba(0, 0, 0, 0.9)' : 'rgba(148, 163, 184, 0.3)',
        }}
        transition={{
          type: 'spring',
          damping: 25,
          stiffness: 400,
          mass: 1,
        }}
        className="backdrop-blur-xl overflow-hidden shadow-2xl flex items-center justify-center border border-white/5"
      >
        <AnimatePresence mode="wait">
          {isVisible || isHovered ? (
            <motion.div
              key="toolbar-content"
              initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex items-center gap-1 p-1 whitespace-nowrap"
            >
              {/* View Controls   */}
              <ButtonToolbar onClick={handleFitToWidth}>
                <Maximize2 className="w-4 h-4" />
              </ButtonToolbar>

              <div className="w-px h-4 bg-white/10 mx-1" />

              {/* Zoom Controls */}
              <div className="flex items-center gap-0.5">
                <ButtonToolbar onClick={handleZoomOut}>
                  <Minus className="w-4 h-4" />
                </ButtonToolbar>

                <ButtonToolbar
                  onClick={handleResetZoom}
                  className="font-bold text-[11px] min-w-[50px] text-white"
                >
                  {Math.round(zoom * 100)}%
                </ButtonToolbar>

                <ButtonToolbar onClick={handleZoomIn}>
                  <Plus className="w-4 h-4" />
                </ButtonToolbar>
              </div>

              <div className="w-px h-4 bg-white/10 mx-1" />

              {/* Page Navigation */}
              <form onSubmit={handlePageSubmit} className="flex items-center gap-1.5 px-2">
                <input
                  type="text"
                  value={currentPageInput}
                  onChange={(e) => setCurrentPageInput(e.target.value)}
                  onBlur={() => setCurrentPageInput(displayActivePage.toString())}
                  className="w-8 h-7 text-center text-[11px] font-bold bg-white/5 text-white border-none rounded-md focus:ring-1 focus:ring-white/20 transition-all outline-none"
                />
                <span className="text-[11px] font-medium text-white/30">/</span>
                <span className="text-[11px] font-medium text-white/60 min-w-[20px] text-center">
                  {displayTotalPages}
                </span>
              </form>

              <div className="flex items-center">
                <ButtonToolbar
                  onClick={() => {
                    const idx = displayActivePage - 2;
                    if (idx >= 0) {
                      if (onPageChange) onPageChange(idx);
                      else setScrollToPageId(pageIds[idx]);
                    }
                  }}
                  disabled={displayActivePage <= 1}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </ButtonToolbar>
                <ButtonToolbar
                  onClick={() => {
                    const idx = displayActivePage;
                    if (idx < displayTotalPages) {
                      if (onPageChange) onPageChange(idx);
                      else setScrollToPageId(pageIds[idx]);
                    }
                  }}
                  disabled={displayActivePage >= displayTotalPages}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </ButtonToolbar>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});
