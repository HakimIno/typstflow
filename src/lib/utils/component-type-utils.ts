import type { ComponentNode } from '@/types/schema';

export function isTableLikeType(type: ComponentNode['type']): boolean {
  return type === 'table' || type === 'form-table';
}
