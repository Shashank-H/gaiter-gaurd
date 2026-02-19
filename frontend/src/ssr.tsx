import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';

// SSR entry point: TanStack Start request handler using streaming
export default createStartHandler(defaultStreamHandler);
