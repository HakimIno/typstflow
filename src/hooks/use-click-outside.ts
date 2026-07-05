'use client';

import { type RefObject, useEffect, useRef } from 'react';

/**
 * Invoke `onOutside` when a mousedown lands outside every element in `refs`.
 * Listens on `document` only while `enabled` is true. The latest `refs` and
 * `onOutside` are always used, so inline callbacks are fine.
 */
export function useClickOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  onOutside: () => void,
  enabled = true
): void {
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const onOutsideRef = useRef(onOutside);
  onOutsideRef.current = onOutside;

  useEffect(() => {
    if (!enabled) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInside = refsRef.current.some((ref) => ref.current?.contains(target));
      if (!isInside) onOutsideRef.current();
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [enabled]);
}
