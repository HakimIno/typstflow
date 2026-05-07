import { clsx } from 'clsx';
import type { DesignerInputProps } from '../../../shared/DesignerInput';
import { DesignerInput } from '../../../shared/DesignerInput';

export const MiniInput = (props: DesignerInputProps) => (
  <DesignerInput
    {...props}
    className={clsx(
      'h-7 text-[10px] px-1.5 py-1 bg-[var(--bg-surface)] border-[var(--border-default)] rounded focus:border-[var(--accent)] transition-all',
      props.className
    )}
  />
);
