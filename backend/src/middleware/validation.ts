// Zod-based request validation middleware

import { z } from 'zod';

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  statusCode = 400;
  issues: Array<{ path: string[]; message: string }>;

  constructor(zodError: z.ZodError) {
    // Use first error message as main message for convenience
    const firstIssue = zodError.issues[0];
    const message = firstIssue
      ? `${firstIssue.path.join('.')}: ${firstIssue.message}`
      : 'Validation failed';

    super(message);

    this.name = 'ValidationError';
    this.issues = zodError.issues.map((issue) => ({
      path: issue.path.map(String),
      message: issue.message,
    }));
  }
}

/**
 * Validates request body against a Zod schema.
 * Throws ValidationError if validation fails.
 *
 * Usage:
 *   const data = await validateBody(mySchema)(req);
 *
 * @returns Typed data that conforms to schema
 * @throws {ValidationError} If validation fails
 * @throws {Error} If request body is not valid JSON
 */
export function validateBody<T extends z.ZodSchema>(schema: T) {
  return async (req: Request): Promise<z.infer<T>> => {
    let body: unknown;

    try {
      body = await req.json();
    } catch (error) {
      throw new ValidationError(
        new z.ZodError([
          {
            code: 'custom',
            message: 'Invalid JSON in request body',
            path: [],
          },
        ])
      );
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      throw new ValidationError(result.error);
    }

    return result.data;
  };
}
