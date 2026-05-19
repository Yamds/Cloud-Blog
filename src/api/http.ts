interface ApiErrorShape {
  error: {
    code?: string;
    message?: string;
  };
}

export interface JsonRequestInit extends Omit<RequestInit, "body" | "headers"> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  headers?: HeadersInit;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly details?: unknown;
  readonly cause?: unknown;

  constructor(options: {
    code: string;
    message: string;
    status?: number | null;
    details?: unknown;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status ?? null;
    this.details = options.details;
    this.cause = options.cause;
  }
}

const isApiErrorShape = (value: unknown): value is ApiErrorShape => {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }

  const errorValue = value.error;
  return typeof errorValue === "object" && errorValue !== null;
};

const isNativeBody = (body: JsonRequestInit["body"]): body is BodyInit =>
  typeof body === "string" ||
  body instanceof Blob ||
  body instanceof FormData ||
  body instanceof URLSearchParams ||
  body instanceof ArrayBuffer;

const buildHeaders = (headers?: HeadersInit) => {
  const resolvedHeaders = new Headers(headers);
  resolvedHeaders.set("Accept", "application/json");
  return resolvedHeaders;
};

const parseJsonResponse = async (response: Response) => {
  const rawText = await response.text();

  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch (error) {
    throw new ApiError({
      code: "INVALID_JSON",
      message: "服务返回了无法解析的 JSON 响应。",
      status: response.status,
      details: rawText,
      cause: error,
    });
  }
};

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export async function requestJson<T>(input: string, init: JsonRequestInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const requestHeaders = buildHeaders(headers);
  const requestInit: RequestInit = {
    credentials: "include",
    ...rest,
    headers: requestHeaders,
  };

  if (body !== undefined && body !== null) {
    if (isNativeBody(body)) {
      requestInit.body = body;
    } else {
      requestHeaders.set("Content-Type", "application/json");
      requestInit.body = JSON.stringify(body);
    }
  }

  let response: Response;

  try {
    response = await fetch(input, requestInit);
  } catch (error) {
    throw new ApiError({
      code: "FETCH_FAILED",
      message: "无法连接到服务，请稍后重试。",
      cause: error,
    });
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    if (isApiErrorShape(payload)) {
      throw new ApiError({
        code: payload.error.code || "HTTP_ERROR",
        message: payload.error.message || "请求失败。",
        status: response.status,
        details: payload,
      });
    }

    throw new ApiError({
      code: response.status === 404 ? "NOT_FOUND" : "HTTP_ERROR",
      message: response.statusText || "请求失败。",
      status: response.status,
      details: payload,
    });
  }

  if (isApiErrorShape(payload)) {
    throw new ApiError({
      code: payload.error.code || "HTTP_ERROR",
      message: payload.error.message || "请求失败。",
      status: response.status,
      details: payload,
    });
  }

  return payload as T;
}
