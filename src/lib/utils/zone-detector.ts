'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import type { LayoutSchema, ZoneKey } from '@/types/schema';

interface ZoneInfo {
  zoneKey: ZoneKey;
  pageId?: string;
  groupId?: string;
  groupType?: 'header' | 'footer';
  element: HTMLElement;
  rect: DOMRect;
}

/**
 * Detect which zone is at the given screen coordinates
 * Used for cross-zone drag and drop
 */
export function detectZoneAtPoint(clientX: number, clientY: number): ZoneInfo | null {
  // Find all zone elements
  const zoneElements = document.querySelectorAll('[data-zone-key]');

  for (const element of zoneElements) {
    const rect = element.getBoundingClientRect();
    const zoneKey = element.getAttribute('data-zone-key') as ZoneKey;
    const pageId = element.getAttribute('data-page-id') || undefined;
    const groupId = element.getAttribute('data-group-id') || undefined;
    const groupType = element.getAttribute('data-group-type') as 'header' | 'footer' | undefined;

    // Check if point is within this zone
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return {
        zoneKey,
        pageId,
        groupId,
        groupType,
        element: element as HTMLElement,
        rect,
      };
    }
  }

  return null;
}

/**
 * Calculate the position in mm relative to a zone.
 * Uses LayoutEngine for accurate absolute position then subtracts zone offset.
 */
export function calculateZonePosition(
  clientX: number,
  clientY: number,
  _zoneRect: DOMRect,
  _zoom: number,
  targetZoneKey?: string,
  targetPageId?: string,
  schema?: LayoutSchema
): { x: number; y: number } {
  const currentSchema = schema || useDesignerStore.getState().schema;

  // Pass targetPageId so calculateAbsolutePosition uses the correct page container rect.
  // Without this, it always falls back to the first page's container, giving wrong coords
  // when dropping onto a zone on any page other than page 1.
  const pos = LayoutEngine.calculateAbsolutePosition(clientX, clientY, 0, 0, targetPageId);

  let finalY = pos.rawY;

  if (targetZoneKey && currentSchema) {
    try {
      const zoneOffset = LayoutEngine.calculateZoneOffset(
        targetZoneKey,
        currentSchema,
        targetPageId
      );
      finalY = pos.rawY - zoneOffset;
    } catch {
      // Fall back to raw position
    }
  }

  return { x: pos.rawX, y: finalY };
}

/**
 * Check if a zone is different from another zone
 */
export function isDifferentZone(
  zone1: { zoneKey: ZoneKey; pageId?: string },
  zone2: { zoneKey: ZoneKey; pageId?: string }
): boolean {
  return zone1.zoneKey !== zone2.zoneKey || zone1.pageId !== zone2.pageId;
}
