import { createRootRouteWithContext, createRoute } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Root } from './root';
import { Landing } from './landing';
import { AdapterList } from './list';
import { AdapterDetail } from './detail';

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Root });

/** The landing page: what this is, why it exists, and how to try it. */
const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Landing });

/** Filters live in the URL so a filtered view is a link someone can share. */
const listSearchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  capability: z.string().optional(),
});

const listRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/adapters',
  component: AdapterList,
  validateSearch: listSearchSchema,
});

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/adapters/$adapterId',
  component: AdapterDetail,
});

export const routeTree = rootRoute.addChildren([landingRoute, listRoute, detailRoute]);
export { listRoute, detailRoute };
