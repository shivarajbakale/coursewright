import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { CrashState } from '@/components/ErrorBoundary';

/** A route that throws keeps the shell and shows the app's crash state, not the router's default. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <CrashState
      error={error instanceof Error ? error : new Error(String(error))}
      onReset={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}
