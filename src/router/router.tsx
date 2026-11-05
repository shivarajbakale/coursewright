import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import App from '@/App';
import { Dashboard } from '@/pages/Dashboard';
import { Settings } from '@/pages/Settings';
import { InboxPage } from '@/pages/InboxPage';
import { TeamPage } from '@/pages/TeamPage';
import { BillingPage } from '@/pages/BillingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { LoginPage } from '@/pages/Auth/LoginPage';
import { SignupPage } from '@/pages/Auth/SignupPage';
import { CustomersPage } from '@/pages/Customers/CustomersPage';
import { CustomerDetailPage } from '@/pages/Customers/CustomerDetailPage';

const rootRoute = createRootRoute({ component: App, notFoundComponent: NotFoundPage });

// Public (no auth) — the AuthGuard in App.tsx lets these through.
const loginRoute = createRoute({ path: '/login', component: LoginPage, getParentRoute: () => rootRoute });
const signupRoute = createRoute({ path: '/signup', component: SignupPage, getParentRoute: () => rootRoute });

// Protected
const indexRoute = createRoute({ path: '/', component: Dashboard, getParentRoute: () => rootRoute });

// The collection and one of its members are two routes, not two panes. The
// list is what you scan and filter; the account is what you read, and it gets
// the whole width to do it in. See docs/principles/screen-archetypes.md — the
// `list` and `detail` shapes.
const customersRoute = createRoute({
  path: '/customers',
  component: CustomersPage,
  getParentRoute: () => rootRoute,
});
const customerDetailRoute = createRoute({
  path: '/customers/$customerId',
  component: CustomerDetailPage,
  getParentRoute: () => rootRoute,
});

const settingsRoute = createRoute({ path: '/settings', component: Settings, getParentRoute: () => rootRoute });
const inboxRoute = createRoute({ path: '/inbox', component: InboxPage, getParentRoute: () => rootRoute });
const teamRoute = createRoute({ path: '/team', component: TeamPage, getParentRoute: () => rootRoute });
const billingRoute = createRoute({ path: '/billing', component: BillingPage, getParentRoute: () => rootRoute });

const routeTree = rootRoute.addChildren([
  loginRoute,
  signupRoute,
  indexRoute,
  customersRoute,
  customerDetailRoute,
  settingsRoute,
  inboxRoute,
  teamRoute,
  billingRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default router;
