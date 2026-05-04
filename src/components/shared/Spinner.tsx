import clsx from 'clsx';
import { LoaderIcon } from 'lucide-react';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={clsx('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export default Spinner;
