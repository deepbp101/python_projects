"use client";

/** Thin fetch wrapper so every form surfaces server error messages the same way. */

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload?.error ?? "Something went wrong. Please try again.",
      payload?.details,
    );
  }

  return payload as T;
}

/**
 * Multipart counterpart to `apiFetch`, for anything carrying files.
 *
 * No Content-Type header is set on purpose: the browser has to add its own
 * multipart boundary, and overriding it makes the body unparseable server-side.
 */
export async function apiUpload<T = unknown>(
  url: string,
  form: FormData,
): Promise<T> {
  const response = await fetch(url, { method: "POST", body: form });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload?.error ?? "Something went wrong. Please try again.",
      payload?.details,
    );
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
