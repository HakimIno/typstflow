import { clsx } from 'clsx';
import type { DesignerInputProps } from '../../../shared/DesignerInput';
import { DesignerInput } from '../../../shared/DesignerInput';

export const MiniInput = (props: DesignerInputProps) => (
  <DesignerInput
    variant="mini"
    {...props}
    className={clsx(
      'bg-[var(--bg-surface)] border-[var(--border-default)] rounded focus:border-[var(--accent)] transition-all',
      props.className
    )}
  />
);
