# Phase 6: Dashboard - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Web dashboard for human oversight of AI agent actions. Users can view pending actions and approve or deny them, plus manage services through the UI. This phase delivers the approval queue interface and service management screens — no new backend capabilities (those exist from Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Approval queue UX
- Card-based layout — each pending action as its own card
- Intent-focused card content: agent's stated intent prominently displayed, plus HTTP method, target URL, and risk score
- Full request details available on card expand (headers, body, risk breakdown)
- Swipe right to approve, swipe left to deny (mobile-first gesture interaction), with button fallback for desktop
- Pending actions only — no history of past decisions in v1 (clean, focused view)

### Tech stack and architecture
- TanStack Start as the frontend framework (full-stack React)
- oat.ink (`@knadh/oat`) for UI styling — semantic HTML, minimal classes, dark/light theme support
- Separate frontend app in `frontend/` directory — clean separation from backend
- TanStack Query (React Query) for data fetching, caching, and mutations against backend REST API
- Polling / HTTP long polling (SSE) for real-time updates on new pending actions — keep flexible for future WebSocket implementation
- All API URLs centralized in one place for maintainability
- Bun.js as the runtime

### Claude skills usage
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

</decisions>

<specifics>
## Specific Ideas

- Vercel-style dark theme — developer-focused, modern aesthetic
- Swipe gestures for approve/deny (mobile-first, like Tinder for API approvals)
- oat.ink for semantic HTML styling — minimal class usage, clean markup
- Components-first approach: build primitives, then compose pages
- All API endpoint URLs in a single centralized config for maintainability

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-dashboard*
*Context gathered: 2026-02-17*
