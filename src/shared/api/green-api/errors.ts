export class GreenApiError extends Error {
  readonly status: number | null;
  readonly details: unknown;

  constructor(
    message: string,
    status: number | null = null,
    details: unknown = null,
  ) {
    super(message);
    this.name = "GreenApiError";
    this.status = status;
    this.details = details;
  }

  get isUnauthorized() {
    return this.status === 401 || this.status === 403;
  }
}
