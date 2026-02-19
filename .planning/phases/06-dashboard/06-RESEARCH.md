# Phase 6: Dashboard - Research

**Researched:** 2026-02-17
**Domain:** TanStack Start + React, oat.ink, TanStack Query, swipe gestures, REST API design
**Confidence:** MEDIUM-HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Approval queue UX
- Card-based layout — each pending action as its own card
- Intent-focused card content: agent's stated intent prominently displayed, plus HTTP method, target URL, and risk score
- Full request details available on card expand (headers, body, risk breakdown)
- Swipe right to approve, swipe left to deny (mobile-first gesture interaction), with button fallback for desktop
- Pending actions only — no history of past decisions in v1 (clean, focused view)

#### Tech stack and architecture
- TanStack Start as the frontend framework (full-stack React)
- oat.ink (`@knadh/oat`) for UI styling — semantic HTML, minimal classes, dark/light theme support
- Separate frontend app in `frontend/` directory — clean separation from backend
- TanStack Query (React Query) for data fetching, caching, and mutations against backend REST API
- Polling / HTTP long polling (SSE) for real-time updates on new pending actions — keep flexible for future WebSocket implementation
- All API URLs centralized in one place for maintainability
- Bun.js as the runtime

#### Claude skills usage
- Use `frontend-design` skill for ALL dashboard pages — consistent production-grade quality throughout
- Build reusable component primitives first (Button, Card, Badge, etc.), then compose pages from them
- Vercel-style dark theme aesthetic — developer-focused, modern, clean

### Claude's Discretion
- Exact component library structure and naming
- TanStack Start routing configuration
- Polling interval and SSE implementation details
- Responsive breakpoints and mobile layout specifics
- Loading states and skeleton designs
- Error state presentation

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User can view pending actions with full request context and approve or deny them | TanStack Query polling against new `GET /approvals/pending` endpoint; `PATCH /approvals/:actionId/approve` and `/deny`; swipe gestures via `@use-gesture/react` + `@react-spring/web` |
| DASH-02 | User can register, edit, and delete services with their API keys through the UI | Existing backend endpoints: `POST/GET /services`, `PUT/DELETE /services/:id`, `POST /services/:id/credentials` — all covered by Phase 5 |
</phase_requirements>

---

## Summary

Phase 6 builds a standalone React frontend in the `frontend/` directory using TanStack Start (the active replacement for the deprecated `@tanstack/start` package — correct package is `@tanstack/react-start` v1.160.x). The frontend communicates with the existing Phase 5 Bun backend via REST API fetch calls managed by TanStack Query.

**Critical gap discovered:** The backend (Phase 5) has NO dashboard-facing approval management endpoints. The Phase 5 backend only has `GET /status/:actionId` (agent polling) and no way for the dashboard to list or action pending approvals. Phase 6 must add three new backend endpoints as its first task: `GET /approvals/pending` (list all pending for user), `PATCH /approvals/:actionId/approve`, and `PATCH /approvals/:actionId/deny`. These are small additions that use the existing `transitionStatus()` service function — they are frontend-phase work that's necessary to make the dashboard functional.

oat.ink is a zero-dependency semantic HTML CSS/JS library (~8KB). It styles semantic HTML elements (`<button>`, `<article>`, `<h1>`, etc.) with no classes needed for basics, uses `data-theme="dark"` on `<body>` for dark mode, and auto-detects system preference. The Vercel-style dark aesthetic desired is achievable by combining oat.ink's dark theme with custom CSS variable overrides. Its npm package `@knadh/oat` provides the CSS and minimal JS for web components (accordion, dialog, etc.).

**Primary recommendation:** Stand up the TanStack Start frontend using `bun create @tanstack/start@latest` (which scaffolds `@tanstack/react-start`), set `server.preset: 'bun'` in vite.config.ts, add `@tanstack/react-query` for data fetching with `refetchInterval` polling, add `@use-gesture/react` + `@react-spring/web` for swipe gestures, and import `@knadh/oat` CSS globally in the root route.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-start` | ^1.160.x | Full-stack React framework with SSR, file-based routing | Replaces deprecated `@tanstack/start`; current active package |
| `@tanstack/react-router` | ^1.160.x | File-based routing, `beforeLoad` auth guards, type-safe routes | Included with react-start; powers all routing |
| `@tanstack/react-query` | ^5.90.x | Server state, polling, mutations with cache | Standard for REST data management in TanStack ecosystem |
| `react` + `react-dom` | ^19.0.0 | UI framework | Required; Bun preset requires React 19 |
| `@knadh/oat` | latest | Semantic HTML CSS/JS UI library | Locked decision; ~8KB, zero deps, dark theme support |
| `@use-gesture/react` | ^10.x | Swipe/drag gesture detection | Standard for touch gesture handling in React |
| `@react-spring/web` | ^9.x | Physics-based animation for swipe card effect | Standard companion to use-gesture for smooth animations |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vite` | ^7.3.x | Build tool (bundler) | Dev server + production build |
| `@vitejs/plugin-react` | ^4.3.x | React JSX transform for Vite | Required by TanStack Start |
| `vite-tsconfig-paths` | ^5.x | TypeScript path aliases in Vite | Cleaner imports (`@/...`) |
| `typescript` | ^5.7.x | Type safety | Project standard |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@use-gesture/react` + `@react-spring/web` | `react-swipeable` alone | react-swipeable is simpler but no physics-based card-fly-out animation; use-gesture + spring gives the Tinder-card feel |
| `@tanstack/react-query` polling | SSE + EventSource | Polling is simpler to implement and test; SSE is more efficient at scale but needs backend SSE endpoint; polling wins for v1 |
| oat.ink dark theme | Custom CSS from scratch | oat.ink provides the semantic styling baseline; override CSS vars for Vercel aesthetic |

### Installation

```bash
# In /frontend directory
bun create @tanstack/start@latest .
# Then add:
bun add @tanstack/react-query @knadh/oat @use-gesture/react @react-spring/web
bun add -d @types/bun
```

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/
├── app.config.ts          # TanStack Start config (server preset: 'bun')
├── vite.config.ts         # Vite plugins config
├── package.json
├── tsconfig.json
├── src/
│   ├── router.tsx         # Router + QueryClient factory
│   ├── client.tsx         # Browser entry point
│   ├── api/
│   │   └── endpoints.ts   # ALL backend API URLs centralized here
│   ├── lib/
│   │   └── api-client.ts  # Authenticated fetch wrapper
│   ├── routes/
│   │   ├── __root.tsx     # Root layout: oat.ink CSS import, QueryClientProvider
│   │   ├── index.tsx      # Redirect to /queue
│   │   ├── login.tsx      # Login page (unauthenticated)
│   │   ├── _auth.tsx      # Auth layout route (beforeLoad guard)
│   │   ├── _auth/
│   │   │   ├── queue.tsx  # Approval queue page (DASH-01)
│   │   │   └── services/
│   │   │       ├── index.tsx    # Services list (DASH-02)
│   │   │       ├── new.tsx      # Create service form
│   │   │       └── $id.edit.tsx # Edit service form
│   ├── components/
│   │   ├── primitives/    # Button, Badge, Card, Modal, Spinner, Skeleton
│   │   └── approval/      # SwipeCard, ActionCardExpanded, QueueEmpty
│   └── styles/
│       └── overrides.css  # oat.ink CSS variable overrides for Vercel dark theme
```

### Pattern 1: vite.config.ts with Bun Preset

**What:** Configure TanStack Start to output for Bun runtime
**When to use:** Every TanStack Start + Bun project

```typescript
// Source: https://bun.com/docs/guides/ecosystem/tanstack-start
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart({ server: { preset: 'bun' } }),
    viteReact(),
  ],
})
```

Note: Some examples put the preset in `app.config.ts` using `defineConfig` from `@tanstack/start/config` — verify which works for v1.160.x by checking the scaffolded output from `bun create @tanstack/start@latest`.

### Pattern 2: Router + QueryClient Setup (router.tsx)

**What:** Create router with QueryClient in context so routes can use it in `beforeLoad`
**When to use:** Root setup; run once per request in SSR

```typescript
// Source: TanStack Router examples/react/start-basic-react-query
import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s — don't refetch unnecessarily
        retry: 1,
      },
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  })

  return { router, queryClient }
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>['router']
  }
}
```

### Pattern 3: Root Route with oat.ink and QueryClientProvider (__root.tsx)

**What:** Global layout — imports oat.ink CSS, wraps with QueryClientProvider
**When to use:** Single root layout

```typescript
// Source: TanStack Router docs + oat.ink usage docs
import { createRootRouteWithContext, Outlet, HeadContent, Scripts } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@knadh/oat/dist/oat.min.css'
import '../styles/overrides.css'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Gaiter Guard' },
    ],
    links: [],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()
  return (
    <html>
      <head><HeadContent /></head>
      <body data-theme="dark">
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
```

Note: `data-theme="dark"` on `<body>` activates oat.ink's bundled dark theme. For auto system-preference detection, add oat.ink's JS inline script in `<head>`.

### Pattern 4: Protected Route Guard (_auth.tsx)

**What:** Layout route that checks JWT token and redirects to login
**When to use:** All authenticated pages

```typescript
// Source: TanStack Router authenticated-routes docs
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { getStoredToken } from '../lib/api-client'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const token = getStoredToken()
    if (!token) {
      throw redirect({ to: '/login', search: { redirect: location.pathname } })
    }
    return { token }
  },
  component: () => <Outlet />,
})
```

### Pattern 5: TanStack Query Polling for Approval Queue

**What:** Poll backend every N seconds for new pending actions; auto-stop when tab hidden
**When to use:** Approval queue page

```typescript
// Source: TanStack Query v5 useQuery docs
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/endpoints'

export function useApprovalQueue() {
  return useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => api.listPendingApprovals(),
    refetchInterval: 5_000,           // Poll every 5 seconds
    refetchIntervalInBackground: false, // Pause when tab not focused
  })
}

// Optimistic removal after approve/deny mutation
export function useApproveAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (actionId: string) => api.approveAction(actionId),
    onMutate: async (actionId) => {
      // Cancel in-flight refetch to prevent overwrite
      await queryClient.cancelQueries({ queryKey: ['approvals', 'pending'] })
      // Optimistically remove card from queue
      queryClient.setQueryData(['approvals', 'pending'], (old: PendingAction[]) =>
        old.filter((a) => a.action_id !== actionId)
      )
    },
    onError: () => {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] })
    },
  })
}
```

### Pattern 6: Swipe Gesture Card

**What:** Draggable card that flies out right (approve) or left (deny) on swipe
**When to use:** Each pending approval card

```typescript
// Source: use-gesture docs + react-spring docs
import { useDrag } from '@use-gesture/react'
import { useSpring, animated } from '@react-spring/web'

interface SwipeCardProps {
  onApprove: () => void
  onDeny: () => void
  children: React.ReactNode
}

export function SwipeCard({ onApprove, onDeny, children }: SwipeCardProps) {
  const SWIPE_THRESHOLD = 100 // px before triggering action

  const [{ x, rotate, opacity }, api] = useSpring(() => ({
    x: 0, rotate: 0, opacity: 1,
  }))

  const bind = useDrag(({ active, movement: [mx], direction: [dx], velocity: [vx], cancel }) => {
    if (active && Math.abs(mx) > SWIPE_THRESHOLD) {
      // Threshold crossed — fly card out
      api.start({ x: mx > 0 ? 500 : -500, rotate: mx > 0 ? 15 : -15, opacity: 0 })
      cancel()
      // Call action after animation
      setTimeout(() => { mx > 0 ? onApprove() : onDeny() }, 300)
    } else {
      api.start({
        x: active ? mx : 0,
        rotate: active ? mx / 20 : 0,
        opacity: 1,
        immediate: active,
      })
    }
  }, {
    axis: 'x',        // Lock to horizontal axis
    filterTaps: true, // Distinguish taps from drags
  })

  return (
    <animated.div
      {...bind()}
      style={{ x, rotate, opacity, touchAction: 'none' }} // touchAction prevents scroll conflict
    >
      {children}
    </animated.div>
  )
}
```

### Pattern 7: Centralized API Endpoints (endpoints.ts)

**What:** Single source of truth for all backend URLs and fetch logic
**When to use:** All API calls go through this module

```typescript
// src/api/endpoints.ts
const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

function getToken(): string {
  return localStorage.getItem('access_token') ?? ''
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...init.headers,
    },
  })
  if (res.status === 401) {
    // Token expired — clear and redirect to login
    localStorage.removeItem('access_token')
    window.location.href = '/login'
  }
  return res
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetch(`${BACKEND_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json()),

  // Approvals (dashboard-facing — Phase 6 adds these to backend)
  listPendingApprovals: () =>
    authedFetch('/approvals/pending').then((r) => r.json()),
  approveAction: (actionId: string) =>
    authedFetch(`/approvals/${actionId}/approve`, { method: 'PATCH' }).then((r) => r.json()),
  denyAction: (actionId: string) =>
    authedFetch(`/approvals/${actionId}/deny`, { method: 'PATCH' }).then((r) => r.json()),

  // Services (all exist in Phase 5 backend)
  listServices: () => authedFetch('/services').then((r) => r.json()),
  createService: (data: unknown) =>
    authedFetch('/services', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),
  updateService: (id: number, data: unknown) =>
    authedFetch(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((r) => r.json()),
  deleteService: (id: number) =>
    authedFetch(`/services/${id}`, { method: 'DELETE' }),
  upsertCredentials: (id: number, data: unknown) =>
    authedFetch(`/services/${id}/credentials`, { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json()),
}
```

### Pattern 8: Backend Approval Management Endpoints (NEW — add to backend)

**What:** Three new backend endpoints the dashboard needs; none exist in Phase 5
**When to use:** Must be added to backend before dashboard can function

These endpoints use the already-existing `transitionStatus()` and `getApprovalQueueEntry()` service functions:

```typescript
// backend/src/routes/dashboard.ts  (new file)

// GET /approvals/pending — list all PENDING actions for the authenticated user
// Joins approval_queue with agents to filter by userId
// Returns: { approvals: ApprovalQueueEntry[] }

// PATCH /approvals/:actionId/approve — transition PENDING → APPROVED
// Sets approvalExpiresAt = now + TTL (e.g., 5 minutes)
// Uses: transitionStatus(actionId, 'PENDING', 'APPROVED', { resolvedAt, approvalExpiresAt })

// PATCH /approvals/:actionId/deny — transition PENDING → DENIED
// Uses: transitionStatus(actionId, 'PENDING', 'DENIED', { resolvedAt })

// Ownership check: verify the approval's agent belongs to req.userId
// All three require requireAuth() (JWT, not Agent-Key)
```

### Anti-Patterns to Avoid

- **Using `@tanstack/start` (deprecated):** Use `@tanstack/react-start` v1.160.x — the `@tanstack/start` npm package is deprecated as of v1.121.
- **Calling backend from server functions:** TanStack Start server functions run in the Vite/Nitro process, not alongside the Bun backend. For a separate backend, use plain `fetch()` from TanStack Query's `queryFn` (client-side), not `createServerFn`.
- **Storing JWT in memory only:** On page refresh the token is lost. Use `localStorage` for the access token (acceptable tradeoff for this developer tool) or a secure cookie approach.
- **Not setting `touchAction: 'none'` on swipeable elements:** Without it, browser scroll intercepts the touch gesture on mobile, causing erratic swipe behavior.
- **Mixing oat.ink classes with Tailwind classes:** oat.ink is NOT Tailwind. It uses semantic HTML styling and specific data attributes. Don't add Tailwind unless intentionally overriding.
- **Polling in background:** Set `refetchIntervalInBackground: false` — aggressive polling when the app is hidden wastes resources and drains mobile batteries.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swipe gesture detection | Custom `onTouchStart/onTouchMove` | `@use-gesture/react` useDrag | Cross-browser, handles pointer + touch + mouse uniformly, velocity calculation built-in |
| Card fly-out animation | CSS transitions | `@react-spring/web` useSpring | Physics-based spring makes the animation feel natural; CSS transitions feel mechanical |
| Server state caching | Custom useState + fetch | TanStack Query useQuery | Deduplication, background refetch, stale-while-revalidate, optimistic updates all free |
| Protected routes | Custom auth check in each page | TanStack Router `beforeLoad` layout route | Single auth guard; child routes inherit automatically |
| Polling interval | setInterval in useEffect | `refetchInterval` in useQuery | Tied to query lifecycle; auto-clears on unmount; pauses on window blur |
| Route type safety | Manual route params casting | File-based routes with TanStack Router | Auto-generated `routeTree.gen.ts` provides type-safe params and search params |

**Key insight:** The gesture + animation combo is deceptively complex — velocity, boundary detection, cancel-on-threshold, and animation-to-action timing all have subtle edge cases. `@use-gesture/react` + `@react-spring/web` handle these in ~20 lines vs hundreds of custom code.

---

## Common Pitfalls

### Pitfall 1: Missing Backend Approval Management Endpoints

**What goes wrong:** Dashboard cannot list or action pending approvals — the backend only has `GET /status/:actionId` (agent-facing), not `GET /approvals/pending` or `PATCH /approvals/:id/approve`.
**Why it happens:** Phase 5 built the agent-facing approval flow only; dashboard-facing endpoints were out of scope.
**How to avoid:** The first planning tasks in Phase 6 must add three backend endpoints before building any frontend features.
**Warning signs:** 404 errors when the frontend calls `/approvals/pending`.

### Pitfall 2: Using Deprecated `@tanstack/start` Package

**What goes wrong:** The package installs but receives no updates; configuration format may be different from current docs.
**Why it happens:** `@tanstack/start` was the original package name, deprecated at v1.121.0 when migrated from Vinxi to Vite.
**How to avoid:** Install `@tanstack/react-start`. The `bun create @tanstack/start@latest` CLI scaffolds the correct package internally.
**Warning signs:** Package version stays at 1.120.x; TypeScript errors on `tanstackStart` import from `@tanstack/react-start/plugin/vite`.

### Pitfall 3: React 19 Requirement for Bun Preset

**What goes wrong:** TanStack Start's Bun-specific deployment only works with React 19+. Using React 18 causes build failures.
**Why it happens:** TanStack Start v1.160.x uses React 19 APIs internally for SSR streaming.
**How to avoid:** Ensure `"react": "^19.0.0"` in package.json.
**Warning signs:** Build error mentioning React version incompatibility.

### Pitfall 4: TanStack Start Server Functions vs. Separate Backend

**What goes wrong:** Developer uses `createServerFn` expecting it to proxy to the Bun backend, but server functions run in the Nitro/Vite process, not alongside the backend server.
**Why it happens:** TanStack Start's documentation emphasizes server functions for full-stack apps, but this project has a separate backend.
**How to avoid:** Use TanStack Query's `queryFn` with plain `fetch()` to call the Bun backend at its URL. Server functions are NOT needed for this architecture.
**Warning signs:** Server functions work in dev but fail in production because the Bun backend URL isn't available in the Nitro environment.

### Pitfall 5: Swipe Gesture Conflicts with Browser Scroll

**What goes wrong:** On mobile, horizontal swipe on cards also triggers vertical scroll; drag feels unresponsive.
**Why it happens:** Browser's default touch behavior intercepts pointer events.
**How to avoid:** Set `style={{ touchAction: 'none' }}` on the animated container element. Also set `touch-action: none` in CSS for the swipeable element.
**Warning signs:** Swipe on mobile causes page to scroll instead of moving the card.

### Pitfall 6: Race Condition Between Optimistic Update and Polling

**What goes wrong:** After approving/denying, the optimistic removal is overwritten by the next poll, causing the card to briefly reappear.
**Why it happens:** The `refetchInterval` fires while the mutation is in flight.
**How to avoid:** Use `queryClient.cancelQueries()` in `onMutate` before the optimistic update. This cancels any in-flight refetch.
**Warning signs:** Cards flicker back briefly after swipe.

### Pitfall 7: CORS Between Frontend (port 5173) and Backend (port 3000)

**What goes wrong:** Browser blocks fetch from `localhost:5173` to `localhost:3000` in development.
**Why it happens:** Different ports = different origin = CORS policy applies.
**How to avoid:** Option A: Add `cors` headers to Bun backend for `http://localhost:5173`. Option B: Configure Vite proxy in `vite.config.ts` to forward `/api/*` calls to `localhost:3000` during dev only. Production uses env var for backend URL.
**Warning signs:** Console errors: `Access-Control-Allow-Origin` missing.

---

## Code Examples

Verified patterns from official sources:

### oat.ink Dark Theme Setup

```html
<!-- Source: https://oat.ink/usage/ -->
<!-- Auto-detect system dark/light preference -->
<script>
  (function() {
    var t = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
<!-- OR force dark via body attribute -->
<body data-theme="dark">
```

### oat.ink Card with Badge

```html
<!-- Source: https://oat.ink/components/ -->
<article class="card">
  <header>
    <h3>Delete all user records</h3>
    <span class="badge" data-variant="danger">risk: 0.92</span>
  </header>
  <p>DELETE https://api.userdb.com/users/all</p>
  <footer>
    <menu class="buttons">
      <button data-variant="danger">Deny</button>
      <button data-variant="primary">Approve</button>
    </menu>
  </footer>
</article>
```

### TanStack Query Polling with Auto-Stop

```typescript
// Source: https://tanstack.com/query/v5/docs/framework/react/reference/useQuery
const { data, isPending, isError } = useQuery({
  queryKey: ['approvals', 'pending'],
  queryFn: () => api.listPendingApprovals(),
  refetchInterval: 5_000,           // 5 second poll
  refetchIntervalInBackground: false, // Stop when tab hidden
  select: (data) => data.approvals,  // Extract array from response wrapper
})
```

### TanStack Router beforeLoad Auth Guard

```typescript
// Source: https://deepwiki.com/tanstack/router/9.4-authentication-and-protected-routes
export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      throw redirect({ to: '/login', search: { redirect: location.pathname } })
    }
    return { token }
  },
  component: () => <Outlet />,
})
```

### useDrag Swipe Detection

```typescript
// Source: https://use-gesture.netlify.app/docs/options/
const bind = useDrag(({ movement: [mx], active, velocity: [vx], cancel }) => {
  const shouldFly = Math.abs(mx) > 100 || (!active && Math.abs(vx) > 0.5)
  if (active && shouldFly) {
    flyOut(mx > 0 ? 'right' : 'left')
    cancel() // prevents further drag events
  } else {
    api.start({ x: active ? mx : 0, immediate: active })
  }
}, {
  axis: 'x',        // horizontal only
  filterTaps: true, // don't start drag on click/tap
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@tanstack/start` | `@tanstack/react-start` | v1.121.0 (Vinxi→Vite migration) | Old package deprecated; no updates after v1.120.x |
| `react-use-gesture` (old name) | `@use-gesture/react` | 2021 (v8) | Old package unmaintained; new package is v10+ |
| Vinxi bundler | Vite bundler | TanStack Start v1.121 | Configuration format changed significantly; Vite ecosystem more stable |
| `app.config.ts` with `defineConfig` from `@tanstack/start/config` | `vite.config.ts` with `tanstackStart()` plugin | TanStack Start v1.121 | May be a hybrid depending on scaffolded version — verify from CLI output |

**Deprecated/outdated:**
- `@tanstack/start`: Deprecated. Use `@tanstack/react-start`.
- `react-use-gesture`: Old package name. Use `@use-gesture/react`.
- Vinxi-based TanStack Start config: Pre-v1.121 config format. Use Vite plugin format.

---

## Open Questions

1. **Exact vite.config.ts vs app.config.ts format for v1.160.x**
   - What we know: Pre-Vite used `app.config.ts` with `defineConfig` from `@tanstack/start/config`; post-Vite uses `tanstackStart()` Vite plugin in `vite.config.ts`
   - What's unclear: Whether v1.160.x uses one or both; some sources show both files coexisting
   - Recommendation: Run `bun create @tanstack/start@latest` and observe the scaffolded output — it will be canonical for v1.160.x

2. **oat.ink CSS import path from npm package**
   - What we know: Package is `@knadh/oat`; distributes `oat.min.css` and `oat.min.js`
   - What's unclear: Exact import path from npm (`@knadh/oat/dist/oat.min.css` vs `@knadh/oat/oat.min.css`)
   - Recommendation: Check `node_modules/@knadh/oat/package.json` exports field after install to find correct path

3. **Backend CORS configuration for development**
   - What we know: Bun backend runs on port 3000; TanStack Start dev server likely on port 5173
   - What's unclear: Whether CORS headers should be added to backend or Vite proxy used
   - Recommendation: Add `cors` support to Bun backend (simplest, needed for production too if deployed separately); use `ACCESS_CONTROL_ALLOW_ORIGIN: *` or specific origins

4. **TanStack Start SSR vs SPA mode**
   - What we know: TanStack Start has SSR enabled by default; dashboard is a private app (not SEO-sensitive)
   - What's unclear: Whether to disable SSR for simplicity (SPA mode avoids cookie/session complexity)
   - Recommendation: Use SSR disabled (SPA-like) for this developer tool — simpler JWT/localStorage auth flow; no need for server-side rendering

---

## Backend Endpoints Required (Phase 6 Adds These)

Phase 6 must add these three endpoints to the backend before the dashboard can function. They are small additions using existing service functions:

| Endpoint | Auth | Purpose | Uses |
|----------|------|---------|------|
| `GET /approvals/pending` | JWT (requireAuth) | List all PENDING actions where agent belongs to userId | New DB query: join approvalQueue+agents WHERE status='PENDING' AND agents.userId=userId |
| `PATCH /approvals/:actionId/approve` | JWT (requireAuth) | Transition PENDING → APPROVED | `transitionStatus()` + ownership check |
| `PATCH /approvals/:actionId/deny` | JWT (requireAuth) | Transition PENDING → DENIED | `transitionStatus()` + ownership check |

The `PATCH /approve` endpoint also sets `approvalExpiresAt` so the TTL cleanup job can expire unexecuted approvals.

---

## Sources

### Primary (HIGH confidence)
- `https://oat.ink/usage/` — Installation, dark theme, npm package name confirmed as `@knadh/oat`
- `https://oat.ink/components/` — Component markup patterns for card, badge, button, dialog
- `https://github.com/knadh/oat/blob/master/src/css/utilities.css` — CSS utility class names
- `https://bun.com/docs/guides/ecosystem/tanstack-start` — TanStack Start + Bun setup, React 19 requirement, `bun create` command
- `https://tanstack.com/query/v5/docs/framework/react/reference/useQuery` — `refetchInterval`, `refetchIntervalInBackground` options
- `https://use-gesture.netlify.app/docs/options/` — useDrag options, axis lock, filterTaps
- `https://deepwiki.com/tanstack/router/9.4-authentication-and-protected-routes` — `_auth.tsx` layout route, `beforeLoad` redirect pattern

### Secondary (MEDIUM confidence)
- `https://raw.githubusercontent.com/TanStack/router/main/examples/react/start-basic-react-query/package.json` — Actual dependency versions (`@tanstack/react-start ^1.160.2`, `react ^19.0.0`, `vite ^7.3.1`)
- `https://raw.githubusercontent.com/TanStack/router/main/examples/react/start-bun/package.json` — Bun-specific starter dependencies confirmed
- `https://ollioddi.dev/blog/tanstack-sse-guide` — SSE + TanStack Query invalidation pattern (for future SSE upgrade path)
- `https://ollioddi.dev/blog/tanstack-sse-guide` — Backend SSE ReadableStream pattern

### Tertiary (LOW confidence)
- WebSearch results on swipe gesture Tinder-card pattern — general approach confirmed, exact code details unverified; treat as starting point

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package names and versions confirmed from actual GitHub example package.json files
- Architecture: MEDIUM — patterns verified from official docs + examples, but TanStack Start is fast-moving (v1.160.x); scaffolded output may differ slightly
- Pitfalls: HIGH — most identified through direct inspection of the codebase (missing backend endpoints) and verified deprecation of `@tanstack/start`
- Swipe gesture: MEDIUM — `@use-gesture/react` patterns from official docs; specific code untested

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (TanStack Start is fast-moving; recheck if >30 days old)
