"use client"

import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'
import { useSyncMutations } from '@/hooks/useSyncMutations'

function SyncRunner() {
  useSyncMutations();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000 * 60, // 1 hour
      },
    },
  }))

  const persister = createAsyncStoragePersister({
    storage: {
      getItem: async (key) => await get(key) || null,
      setItem: async (key, value) => await set(key, value),
      removeItem: async (key) => await del(key),
    },
    key: 'qazatrack-query-cache'
  })

  return (
    <PersistQueryClientProvider 
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.queryKey[0] === 'prayerTimes',
        },
      }}
    >
      <ThemeProvider 
        attribute="class" 
        defaultTheme="system" 
        themes={['light', 'dark', 'system', 'ocean', 'rose', 'lavender']}
        enableSystem 
        disableTransitionOnChange
      >
        <SyncRunner />
        {children}
      </ThemeProvider>
    </PersistQueryClientProvider>
  )
}
