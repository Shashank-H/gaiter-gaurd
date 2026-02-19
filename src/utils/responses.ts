// Response utility functions for consistent API responses

/**
 * Creates a JSON response with the given data and status code
 */
export function jsonResponse<T>(data: T, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Creates an error response with consistent structure
 */
export function errorResponse(message: string, statusCode = 500): Response {
  return Response.json(
    {
      error: message,
      statusCode,
    },
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
