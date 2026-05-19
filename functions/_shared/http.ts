export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function json<T>(payload: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return json<ApiErrorPayload>(
    {
      error: {
        code,
        message,
      },
    },
    {
      status,
    },
  );
}

export async function handleRequest(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.status, error.code, error.message);
    }

    console.error("Unhandled API error", error);
    return errorResponse(500, "INTERNAL_ERROR", "Internal server error.");
  }
}
