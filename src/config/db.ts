// Database connection via Drizzle ORM and postgres.js

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from './env';

// Create postgres.js client
export const queryClient = postgres(env.DATABASE_URL, { max: 10 });

// Initialize Drizzle instance
export const db = drizzle({ client: queryClient });
