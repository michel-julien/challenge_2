// Single entry point for all network calls. See API_CONTRACT.md.
//
// Authentication uses an httpOnly session cookie set by the backend, so every
// request is sent with `credentials: "include"`. Tokens are never stored in
// localStorage or anywhere else readable by JavaScript.
import {
  ApiError,
  type ApiClient,
  type LoginInput,
  type RegisterInput,
  type User,
} from "./api-types";
import { mockApi } from "./mock-api";

export * from "./api-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";

/** True when no backend URL is configured and the in-memory mock is used. */
export const isMockApi = API_URL === "";

async function request<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<T> {
  const { body, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Unable to reach the server");
  }

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data: unknown = await res.json();
      if (
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
      ) {
        message = data.error;
      }
    } catch {
      // Non-JSON error body; keep the default message.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const httpApi: ApiClient = {
  async register(input: RegisterInput) {
    const { user } = await request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: input,
    });
    return user;
  },

  async login(input: LoginInput) {
    const { user } = await request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: input,
    });
    return user;
  },

  async logout() {
    await request<void>("/api/auth/logout", { method: "POST" });
  },

  async getMe() {
    try {
      const { user } = await request<{ user: User }>("/api/users/me");
      return user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
};

export const api: ApiClient = isMockApi ? mockApi : httpApi;
