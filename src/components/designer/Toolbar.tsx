'use client';
import { memo } from 'react';
import { SubToolbar } from './toolbar/SubToolbar';
import { TopHeader } from './toolbar/TopHeader';

export const Toolbar = memo(function Toolbar() {
  return (
    <div className="flex flex-col flex-shrink-0 relative z-[100]">
      <TopHeader />
      <SubToolbar />
    </div>
  );
});
