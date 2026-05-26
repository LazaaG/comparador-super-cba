'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PHProvider } from './posthog-provider';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1
          }
        }
      })
  );

  return (
    <PHProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </PHProvider>
  );
}
