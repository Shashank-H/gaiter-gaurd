import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';

const { router, queryClient } = getRouter();

hydrateRoot(
  document,
  <RouterProvider router={router} context={{ queryClient }} />
);
