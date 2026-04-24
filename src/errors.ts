export class PolyviaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class APIError extends PolyviaError {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

export class AuthenticationError extends APIError {}
export class ForbiddenError extends APIError {}
export class NotFoundError extends APIError {}
export class RateLimitError extends APIError {}
export class ServiceUnavailableError extends APIError {}

export class IngestionError extends PolyviaError {
  constructor(
    public readonly taskId: string,
    public readonly error: string,
  ) {
    super(`Ingestion task ${taskId} failed: ${error}`);
  }
}

export class IngestionTimeout extends PolyviaError {
  constructor(taskId: string) {
    super(`Timed out waiting for ingestion task ${taskId}`);
  }
}

export function mapStatusError(status: number, body: unknown): APIError {
  const message =
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    typeof (body as Record<string, unknown>)["detail"] === "string"
      ? (body as Record<string, unknown>)["detail"] as string
      : `HTTP ${status}`;

  switch (status) {
    case 401: return new AuthenticationError(status, message, body);
    case 403: return new ForbiddenError(status, message, body);
    case 404: return new NotFoundError(status, message, body);
    case 429: return new RateLimitError(status, message, body);
    case 503: return new ServiceUnavailableError(status, message, body);
    default:  return new APIError(status, message, body);
  }
}
