'use client';

/**
 * @deprecated Virtualization is now handled at the page level in Canvas.tsx
 * This hook is kept for backward compatibility but returns null (render all)
 * since page-level virtualization is more efficient.
 */

import type { LayoutSchema } from '@/types/schema';

export function useVirtualElements(
  _scrollRef: React.RefObject<HTMLDivElement | null>,
  _zoom: number,
  _schema: LayoutSchema,
  _activePageId?: string | null
) {
  // Return null to indicate "render everything"
  // Canvas.tsx now handles page-level virtualization
  return {
    visibleIds: null,
    visiblePageIds: null,
  };
}
