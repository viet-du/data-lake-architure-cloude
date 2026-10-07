import { Routes, Route, BrowserRouter, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ROUTES, Layout } from '@/navigation';
import { useThemeStore } from '@/store';
import { useThemeTransition } from '@/hooks';
import {
  HomeScreen,
  CatalogScreen,
  BronzeScreen,
  SilverScreen,
  GoldScreen,
  CrawlerScreen,
  KafkaScreen,
  AirflowScreen,
  DQScreen,
  HealthScreen,
  SchematicScreen,
} from '@/screens';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ThemedApp() {
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  useThemeTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={resolvedMode === 'dark' ? 'dark' : ''}>
      <div className="flex h-screen w-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path={ROUTES.HOME} element={<HomeScreen />} />
              <Route path={ROUTES.CATALOG} element={<CatalogScreen />} />
              <Route path={ROUTES.BRONZE} element={<BronzeScreen />} />
              <Route path={ROUTES.SILVER} element={<SilverScreen />} />
              <Route path={ROUTES.GOLD} element={<GoldScreen />} />
              <Route path={ROUTES.CRAWLER} element={<CrawlerScreen />} />
              <Route path={ROUTES.KAFKA} element={<KafkaScreen />} />
              <Route path={ROUTES.AIRFLOW} element={<AirflowScreen />} />
              <Route path={ROUTES.DQ} element={<DQScreen />} />
              <Route path={ROUTES.HEALTH} element={<HealthScreen />} />
              <Route path={ROUTES.SCHEMATIC} element={<SchematicScreen />} />
            </Route>
            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedApp />
    </QueryClientProvider>
  );
}
