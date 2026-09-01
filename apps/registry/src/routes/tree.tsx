import { createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Root } from './root';
import { AdapterList } from './list';
import { AdapterDetail } from './detail';
import { About } from './about';

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Root });

/** Filters live in the URL so a filtered view is a link someone can share. */
const listSearchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  capability: z.string().optional(),
});

const listRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: AdapterList,
  validateSearch: listSearchSchema,
});

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/adapter/$adapterId',
  component: AdapterDetail,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: About,
});

export const routeTree = rootRoute.addChildren([listRoute, detailRoute, aboutRoute]);
export { listRoute, detailRoute };
