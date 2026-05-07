'use client';

import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import {
  type ReactNode,
  createContext,
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

// --- Context ---
interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const DropdownContext = createContext<DropdownContextType | null>(null);

export function useDropdown() {
  const context = useContext(DropdownContext);
  if (!context) throw new Error('useDropdown must be used within a DropdownMenu');
  return context;
}

// --- Main Components ---

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right';
  side?: 'top' | 'bottom';
}

export const DropdownMenu = memo(function DropdownMenu({
  trigger,
  children,
  className,
  align = 'left',
  side = 'bottom',
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: side === 'bottom' ? rect.bottom + window.scrollY : rect.top + window.scrollY,
        left: align === 'left' ? rect.left + window.scrollX : rect.right + window.scrollX,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div className={clsx('inline-block', className)} ref={containerRef}>
        <div
          className="w-full h-full cursor-pointer"
          onClick={toggleMenu}
        >
          {trigger}
        </div>

        {isOpen && createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'absolute',
              top: `${coords.top + (side === 'bottom' ? 6 : -6)}px`,
              left: align === 'left' ? `${coords.left}px` : 'auto',
              right: align === 'right' ? `${window.innerWidth - coords.left}px` : 'auto',
              zIndex: 9999
            }}
            className={clsx(
              'min-w-[180px] pro-panel z-[9999] flex flex-col p-1 shadow-2xl'
            )}
          >
            {children}
          </div>,
          document.body
        )}
      </div>
    </DropdownContext.Provider>
  );
});

// --- Menu Item ---
interface MenuItemProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  label: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'danger';
  rightElement?: ReactNode;
}

export const DropdownMenuItem = memo(function DropdownMenuItem({
  icon: Icon,
  label,
  onClick,
  className,
  variant = 'default',
  rightElement,
}: MenuItemProps) {
  const { setIsOpen } = useDropdown();

  return (
    <button
      type="button"
      className={clsx(
        'w-full text-left px-2 py-1.5 text-[11px] flex items-center justify-between gap-2 rounded-md transition-colors',
        variant === 'danger'
          ? 'text-red-500 hover:bg-red-500/10 active:bg-red-500/20'
          : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-widget)]',
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
        setIsOpen(false);
      }}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
        {label}
      </div>
      {rightElement}
    </button>
  );
});

// --- Header ---
export const DropdownMenuHeader = memo(function DropdownMenuHeader({
  children,
}: { children: ReactNode }) {
  return (
    <div className="px-3 py-1.5 bg-[var(--bg-widget)] border-b border-[var(--border-default)] -mx-1 -mt-1 mb-1 rounded-t-[inherit]">
      <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest block">
        {children}
      </span>
    </div>
  );
});

// --- Separator ---
export const DropdownMenuSeparator = memo(function DropdownMenuSeparator() {
  return <div className="h-px bg-[var(--border-default)] my-1 mx-1" />;
});

// --- Sub Menu ---
interface SubMenuProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}

export const DropdownMenuSub = memo(function DropdownMenuSub({
  icon: Icon,
  label,
  children,
}: SubMenuProps) {
  const [isSubOpen, setIsSubOpen] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsSubOpen(true)}
      onMouseLeave={() => setIsSubOpen(false)}
    >
      <button
        type="button"
        className={clsx(
          'w-full text-left px-2 py-1.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center justify-between gap-2 rounded-md transition-colors',
          isSubOpen && 'bg-[var(--bg-hover)]'
        )}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
          {label}
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">›</div>
      </button>

      {isSubOpen && (
        <div className="absolute left-[calc(100%+4px)] top-0 z-[600]">
          <div className="pro-panel p-1 min-w-[180px] flex flex-col shadow-2xl">{children}</div>
        </div>
      )}
    </div>
  );
});
