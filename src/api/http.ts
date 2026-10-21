export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Turns an error response ({ error } as JSON) into an ApiError. */
export async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new ApiError(body.error ?? res.statusText, res.status);
}
