import Spinner from './Spinner';

interface LoadingProps {
  message?: string;
}

export function Loading({ message }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-3">
      <Spinner className="size-6 text-white" />
      <p className="text-sm text-white">{message}</p>
    </div>
  );
}
