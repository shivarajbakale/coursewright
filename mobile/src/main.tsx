import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CrashScreen } from './components/States';
import { installRandomUUID } from './uid';

installRandomUUID();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary fallback={() => <CrashScreen />}>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
);
