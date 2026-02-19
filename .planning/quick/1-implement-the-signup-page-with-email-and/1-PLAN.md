---
phase: quick-1
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/routes/signup.tsx
  - frontend/src/api/endpoints.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "User can visit /signup and see a signup form with email and password fields"
    - "Submitting valid credentials creates an account and redirects to /login"
    - "Submitting a duplicate email shows a 'Email already in use' error"
    - "Submitting mismatched passwords shows a validation error before any API call"
  artifacts:
    - path: "frontend/src/routes/signup.tsx"
      provides: "Signup page component with TanStack Router file-based route"
      exports: ["Route"]
    - path: "frontend/src/api/endpoints.ts"
      provides: "register() helper added to api object"
      contains: "register:"
  key_links:
    - from: "frontend/src/routes/signup.tsx"
      to: "/auth/register"
      via: "api.register() call on form submit"
      pattern: "api\\.register"
    - from: "frontend/src/routes/login.tsx"
      to: "/signup"
      via: "\"Don't have an account? Sign up\" link"
      pattern: "signup"
---

<objective>
Add a signup page at /signup so new users can register with email and password.

Purpose: The app currently has no way to create an account through the UI. The backend /auth/register endpoint already exists; this plan wires it up with a signup page.
Output: frontend/src/routes/signup.tsx with signup form, api.register() method in endpoints.ts, and a link from the login page to signup.
</objective>

<execution_context>
@/home/shashank/.claude/get-shit-done/workflows/execute-plan.md
@/home/shashank/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@frontend/src/routes/login.tsx
@frontend/src/api/endpoints.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add api.register() to endpoints.ts and create signup.tsx</name>
  <files>frontend/src/api/endpoints.ts, frontend/src/routes/signup.tsx</files>
  <action>
    1. In frontend/src/api/endpoints.ts, add a register method to the api object (after the login method):
       ```ts
       register: async (email: string, password: string) => {
         const res = await fetch(`${BACKEND_BASE}/auth/register`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email, password }),
         });
         return res.json();
       },
       ```

    2. Create frontend/src/routes/signup.tsx modeled exactly on login.tsx's visual style (dark theme, same card layout, same input styles, same button styles, same spinner pattern). Key differences from login:
       - Route: createFileRoute('/signup')
       - Title on card: "Create account" (not "Sign in")
       - Three fields: email, password, confirmPassword (label "Confirm password")
       - Client-side validation: if password !== confirmPassword, set error "Passwords do not match" and return early (no API call)
       - On submit: call api.register(email, password)
       - On success (response has no error field, or response.message === 'User registered'): navigate({ to: '/login' })
       - On 409 error (response.error or response.message contains "already exists"): set error "An account with this email already exists"
       - On other errors: set error from response.message or response.error or 'Registration failed. Please try again.'
       - Below the submit button add a small "Already have an account? Sign in" link using TanStack Link: `import { Link } from '@tanstack/react-router'` with `to="/login"`, styled: `font-size: '0.875rem', color: '#888', textAlign: 'center', marginTop: '0.75rem', display: 'block'`

    3. In frontend/src/routes/login.tsx, below the submit button inside the card div, add a similar "Don't have an account? Sign up" link: `<Link to="/signup" style={{ fontSize: '0.875rem', color: '#888', textAlign: 'center', marginTop: '0.75rem', display: 'block' }}>Don't have an account? Sign up</Link>`. Import Link from '@tanstack/react-router' (add to existing import).
  </action>
  <verify>
    Run `cd /home/shashank/personal/gaiter-gaurd/frontend && bun run build` — build must complete with no TypeScript errors.
    Confirm frontend/src/routes/signup.tsx exists and contains createFileRoute('/signup').
    Confirm frontend/src/api/endpoints.ts contains `register:`.
  </verify>
  <done>
    Build passes. /signup route exists. api.register() is defined. Login page links to /signup. Signup page links back to /login.
  </done>
</task>

</tasks>

<verification>
- `bun run build` from frontend/ completes without errors
- frontend/src/routes/signup.tsx exists with createFileRoute('/signup')
- frontend/src/api/endpoints.ts contains register() method
- login.tsx imports Link and has link to /signup
</verification>

<success_criteria>
User can navigate to /signup, fill in email + password + confirm password, submit, and either land on /login (success) or see a clear error (duplicate email, password mismatch).
</success_criteria>

<output>
After completion, create `.planning/quick/1-implement-the-signup-page-with-email-and/1-SUMMARY.md`
</output>
