/**
 * An error whose message is safe to show to the client.
 * Anything else should be logged and replaced with a generic sentence.
 */
export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export function clientErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) return error.message;
  return fallback;
}

export function clientStatusCode(error: unknown, fallback = 500): number {
  if (error instanceof HttpError) return error.statusCode;
  return fallback;
}
