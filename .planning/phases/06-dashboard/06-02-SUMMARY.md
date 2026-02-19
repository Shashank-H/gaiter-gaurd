---
phase: 06-dashboard
plan: 02
subsystem: ui
tags: [react, tanstack-query, use-gesture, react-spring, swipe, approval-queue, optimistic-update]

# Dependency graph
requires:
  - phase: 06-dashboard
    plan: 01
    provides: TanStack Start scaffold, api.listPendingApprovals/approveAction/denyAction, Button/Badge/Card/Spinner/Skeleton primitives, auth guard layout
  - phase: 05-risk-approval-flow
    provides: approval queue backend, transitionStatus approve/deny endpoints

provides:
  - useApprovalQueue hook (5s polling, background pause, PendingAction type)
  - useApproveAction hook (optimistic card removal, cancelQueries, rollback)
  - useDenyAction hook (same optimistic pattern as approve)
  - SwipeCard component (useDrag x-axis, useSpring physics, 100px threshold, APPROVE/DENY tint overlays)
  - ActionCard component (intent h3, risk badge, method badge, expandable details, desktop buttons)
  - QueueEmpty component (all-clear empty state)
  - /queue page with 5s polling, skeleton loading, stacked swipeable cards, mobile hint

affects:
  - 06-dashboard (plan 03 — services management page reuses hooks/primitives patterns)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic mutation: cancelQueries + setQueryData filter + rollback on error + invalidateQueries on settled"
    - "React 19 + react-spring 9.x: cast animated('div') as unknown as React.FC<AnimatedDivProps> to thread children"
    - "SwipeCard threshold pattern: card follows finger, flies out at 100px, springs back below threshold"
    - "Animated tint overlays: separate AnimatedDiv positioned absolute, opacity driven by SpringValue"

key-files:
  created:
    - frontend/src/hooks/useApprovalQueue.ts
    - frontend/src/hooks/useApproveAction.ts
    - frontend/src/hooks/useDenyAction.ts
    - frontend/src/components/approval/SwipeCard.tsx
    - frontend/src/components/approval/ActionCard.tsx
    - frontend/src/components/approval/QueueEmpty.tsx
  modified:
    - frontend/src/routes/_auth/queue.tsx (replaced placeholder with full implementation)

key-decisions:
  - "React 19 + react-spring 9.x children incompatibility: used as unknown as React.FC<AnimatedDivProps> cast — spring values need Record<string,unknown> style type to accept SpringValue"
  - "Tint overlays as separate AnimatedDiv layers: cleaner than a single div with conditional border-color, avoids flash during spring-back"
  - "FLY_DURATION 300ms before callback: gives animation time to complete before card is removed from DOM"

patterns-established:
  - "Pattern: TanStack Query optimistic mutation = cancelQueries → setQueryData filter → return snapshot → onError revert → onSettled invalidate"
  - "Pattern: useDrag axis:x + filterTaps:true for horizontal swipe with tap-through support"
  - "Pattern: AnimatedDiv tint overlay with pointer-events:none — visual feedback without blocking gesture events"

requirements-completed:
  - DASH-01

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 06 Plan 02: Approval Queue UI Summary

**Swipeable approval queue with TanStack Query optimistic mutations, react-spring physics animation, and useDrag gesture detection — intent-first card design with expandable request details**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T13:33:10Z
- **Completed:** 2026-02-17T13:37:17Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Hooks: Three TanStack Query hooks — `useApprovalQueue` (5s polling, background pause), `useApproveAction` and `useDenyAction` (optimistic card removal with cancelQueries + rollback pattern)
- SwipeCard: Physics-based swipe gesture card using `useDrag` (x-axis lock, 100px threshold) and `useSpring` with APPROVE/DENY animated tint overlays
- Full queue page at `/queue`: skeleton loading, error+retry, empty state, stacked swipeable cards, mobile swipe hint, desktop button fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: TanStack Query hooks for approval queue** - `d2b32d3` (feat)
2. **Task 2: Swipeable action cards and queue page** - `871c7b6` (feat)

## Files Created/Modified

- `frontend/src/hooks/useApprovalQueue.ts` — `useQuery` with 5s poll, `refetchIntervalInBackground: false`, `PendingAction` type export
- `frontend/src/hooks/useApproveAction.ts` — `useMutation` with optimistic filter, cancelQueries, snapshot rollback
- `frontend/src/hooks/useDenyAction.ts` — Same pattern as useApproveAction for deny flow
- `frontend/src/components/approval/SwipeCard.tsx` — `useDrag` + `useSpring`, APPROVE/DENY animated tint overlays, touchAction:none
- `frontend/src/components/approval/ActionCard.tsx` — Intent h3 header, risk/method badges, expandable details (headers, body, risk explanation), desktop approve/deny buttons
- `frontend/src/components/approval/QueueEmpty.tsx` — Centered all-clear empty state with green checkmark icon
- `frontend/src/routes/_auth/queue.tsx` — Full queue page replacing placeholder: polling, skeleton, empty, swipeable cards, mobile hint

## Decisions Made

- **React 19 + react-spring 9.x children type fix**: `animated('div') as unknown as React.FC<AnimatedDivProps>` — react-spring's `AnimatedComponent` ForwardRef type doesn't include `children` in React 19; `as unknown` cast bypasses this while keeping `SpringValue` support via `Record<string, unknown>` style type
- **Tint overlays as separate animated layers**: APPROVE (green) and DENY (red) overlays are `position: absolute` `AnimatedDiv`s with `pointer-events: none` — cleaner separation between gesture tracking and visual feedback
- **300ms fly-out delay before callback**: Card animates to off-screen before `onApprove`/`onDeny` triggers, preventing DOM removal mid-animation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React 19 + react-spring 9.x animated.div children prop type error**
- **Found during:** Task 2 (TypeScript compile)
- **Issue:** `animated.div`'s `AnimatedComponent<'div'>` type doesn't include `children` as a valid prop in React 19 — three TS2322 errors
- **Fix:** Cast `animated('div') as unknown as React.FC<AnimatedDivProps>` where `AnimatedDivProps = React.PropsWithChildren<{ style?: Record<string, unknown>; [key: string]: unknown }>` — preserves children support while keeping spring value compatibility
- **Files modified:** `frontend/src/components/approval/SwipeCard.tsx`
- **Verification:** `bunx tsc --noEmit` exits 0 with no errors
- **Committed in:** 871c7b6

---

**Total deviations:** 1 auto-fixed (1 type incompatibility between React 19 and react-spring 9.x)
**Impact on plan:** Required fix for compilation; no behavior change or scope creep.

## Issues Encountered

None beyond the auto-fixed react-spring type incompatibility.

## User Setup Required

None — no external service configuration required. Frontend runs with `bun run dev` from the `frontend/` directory.

## Next Phase Readiness

- Plan 03 (services management page) can use:
  - Same hook patterns: `useQuery` + `useMutation` with optimistic updates
  - Same primitives: Button, Badge, Card, Spinner, Skeleton, Modal
  - Auth guard via `_auth.tsx` layout — add routes under `_auth/` directory
  - Centralized `api` object in `endpoints.ts` — services CRUD already wired
- The `/queue` page is complete and functional — swipe gestures, button fallback, 5s polling, optimistic removal

## Self-Check: PASSED

Files verified:
- FOUND: frontend/src/hooks/useApprovalQueue.ts
- FOUND: frontend/src/hooks/useApproveAction.ts
- FOUND: frontend/src/hooks/useDenyAction.ts
- FOUND: frontend/src/components/approval/SwipeCard.tsx
- FOUND: frontend/src/components/approval/ActionCard.tsx
- FOUND: frontend/src/components/approval/QueueEmpty.tsx
- FOUND: .planning/phases/06-dashboard/06-02-SUMMARY.md

Commits verified:
- d2b32d3: feat(06-02): TanStack Query hooks for approval queue with optimistic mutations
- 871c7b6: feat(06-02): swipeable approval queue with gesture animation and empty state

---
*Phase: 06-dashboard*
*Completed: 2026-02-17*
