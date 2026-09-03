import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { I18nProvider } from './i18n';
import { loadPublishedCatalog } from './lib/catalog';
import { routeTree } from './routes/tree';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 } },
});

const router = createRouter({ routeTree, context: { queryClient } });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

async function start() {
  // Accepted community submissions appear on the next page load. If GitHub is
  // unavailable, the bundled official collection keeps the Store usable.
  await loadPublishedCatalog();

  const root = document.getElementById('root');
  if (!root) throw new Error('#root is missing');

  createRoot(root).render(
    <StrictMode>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </I18nProvider>
    </StrictMode>,
  );
}

void start();
