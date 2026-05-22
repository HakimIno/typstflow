'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Trash2 } from 'lucide-react';
import { memo } from 'react';
import { ManualGuides } from './ManualGuides';
import { SelectionMarquee } from './SelectionMarquee';
import { SelectionOverlay } from './SelectionOverlay';
import { SelectionToolbar } from './SelectionToolbar';
import { SnapGuides } from './SnapGuides';
import { Zone } from './Zone';

interface DesignerPageProps {
  pageId: string;
  pIdx: number;
}

export const DesignerPage = memo(function DesignerPage({ pageId, pIdx }: DesignerPageProps) {
  // ✅ Subscribes ONLY to its own page data and global config
  const schemaPage = useDesignerStore((s) => s.schema.page);
  const groups = useDesignerStore((s) => s.schema.groups);
  const globalZones = useDesignerStore((s) => s.schema.zones);
  const pageCount = useDesignerStore((s) => s.schema.pages.length);
  const zoom = useDesignerStore((s) => s.zoom);
  const activePageId = useDesignerStore((s) => s.activePageId);
  const setActivePage = useDesignerStore((s) => s.setActivePage);
  const canvasLayout = useDesignerStore((s) => s.canvasLayout);

  const { width: pageWidthMm, height: pageHeightMm } = getPaperDimensions(
    schemaPage.size,
    schemaPage.orientation
  );

  const marginTop = parseTypstUnit(schemaPage.margin.top);
  const marginBottom = parseTypstUnit(schemaPage.margin.bottom);
  const marginLeft = parseTypstUnit(schemaPage.margin.left);
  const marginRight = parseTypstUnit(schemaPage.margin.right);

  return (
    <div
      data-page-wrapper
      data-page-id={pageId}
      style={{
        width: `${LayoutEngine.mmToPx(pageWidthMm) * zoom}px`,
        height: `${LayoutEngine.mmToPx(pageHeightMm) * zoom}px`,
      }}
      className="relative group"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Focus click handler is for visual designer focus, keyboard focus is handled at canvas level */}
      <div
        data-paper-container
        data-page-id={pageId}
        data-zoom={zoom}
        onClick={() => setActivePage(pageId)}
        className={clsx(
          'bg-white border border-slate-300 absolute top-0 left-0 shadow-2xl origin-top-left flex-shrink-0 rounded-[4px] contain-page high-perf-gpu',
          activePageId === pageId && 'ring-2 ring-[var(--accent)] ring-offset-2'
        )}
        style={{
          width: `${LayoutEngine.mmToPx(pageWidthMm)}px`,
          height: `${LayoutEngine.mmToPx(pageHeightMm)}px`,
          transform: `scale(${zoom})`,
        }}
      >
        <div className="absolute left-0 -top-6 text-[10px] font-bold text-slate-400 opacity-60 uppercase tracking-widest pointer-events-none group-hover:opacity-100 transition-opacity">
          Page {pIdx + 1}
        </div>

        {/* Margin Guides */}
        <div
          className="absolute border border-[var(--accent)] border-solid pointer-events-none z-10 opacity-25"
          style={{
            top: `${LayoutEngine.mmToPx(marginTop)}px`,
            bottom: `${LayoutEngine.mmToPx(marginBottom)}px`,
            left: `${LayoutEngine.mmToPx(marginLeft)}px`,
            right: `${LayoutEngine.mmToPx(marginRight)}px`,
          }}
        />

        <SelectionMarquee pageId={pageId} />
        <SelectionOverlay pageId={pageId} />
        <SnapGuides pageId={pageId} />
        <SelectionToolbar pageId={pageId} />

        <div className="flex flex-col gap-0 absolute inset-0 z-20">
          <Zone
            zoneKey="header"
            label={globalZones.header.repeatOnEveryPage ? 'Global Header' : 'Report Header'}
            pageId={pageId}
            minHeight={globalZones.header.minHeight}
            resizeEdge="bottom"
            pageIndex={pIdx}
            hidden={
              !(
                globalZones.header.repeatOnEveryPage ||
                (globalZones.header.showOnFirstPageOnly && pIdx === 0) ||
                (!globalZones.header.repeatOnEveryPage &&
                  !globalZones.header.showOnFirstPageOnly &&
                  pIdx === 0)
              )
            }
          />

          {/* Group Headers */}
          {(groups || []).map((group) => (
            <Zone
              key={`group-h-${group.id}`}
              zoneKey="body"
              label={`Group Header: ${group.name}`}
              pageId={pageId}
              minHeight={group.header.minHeight}
              resizeEdge="bottom"
              pageIndex={pIdx}
              isGroupBand
              groupType="header"
              groupId={group.id}
            />
          ))}

          <Zone
            zoneKey="body"
            label="Detail Band"
            pageId={pageId}
            // Detail band height is flex-1
            minHeight={undefined}
            resizeEdge="none"
            pageIndex={pIdx}
          />

          {/* Group Footers */}
          {[...(groups || [])].reverse().map((group) => (
            <Zone
              key={`group-f-${group.id}`}
              zoneKey="body"
              label={`Group Footer: ${group.name} (Summary)`}
              pageId={pageId}
              minHeight={group.footer.minHeight}
              resizeEdge="top"
              pageIndex={pIdx}
              isGroupBand
              groupType="footer"
              groupId={group.id}
            />
          ))}

          <Zone
            zoneKey="footer"
            label={globalZones.footer.repeatOnEveryPage ? 'Global Footer' : 'Report Footer'}
            pageId={pageId}
            minHeight={globalZones.footer.minHeight}
            resizeEdge="top"
            pageIndex={pIdx}
            hidden={
              !(
                globalZones.footer.repeatOnEveryPage ||
                (globalZones.footer.showOnLastPageOnly && pIdx === pageCount - 1) ||
                (!globalZones.footer.repeatOnEveryPage &&
                  !globalZones.footer.showOnLastPageOnly &&
                  pIdx === 0)
              )
            }
          />
        </div>

        {/* Above zones (z-20) so guide lines stay visible */}
        <ManualGuides />

        {/* Remove Page Button */}
        {pageCount > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              useDesignerStore.getState().removePage(pageId);
            }}
            className={clsx(
              'absolute p-2 rounded-full shadow-md text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100',
              canvasLayout === 'grid' ? 'right-0 -top-10' : '-right-12 top-0'
            )}
            title="Remove Page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
});
