import { createFileRoute, redirect } from '@tanstack/react-router';

// Root index redirects to /queue (the default authenticated view)
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/queue' });
  },
  component: () => null,
});
