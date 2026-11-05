// Single entry point for all network calls. The same client can target either
// backend by changing NEXT_PUBLIC_API_URL.
//
// Authentication uses the httpOnly session cookie set by the backend. Every
// request includes credentials and the JWT is never stored in browser storage.
import {
  ApiError,
  type ApiClient,
  type LoginInput,
  type RegisterInput,
  type User,
  type UserRole,
} from "./api-types";
import { mockApi } from "./mock-api";

export * from "./api-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";

interface BackendUser {
  id: string | number;
  email: string;
  role?: UserRole;
  fullName?: string;
  username?: string;
  studentId?: string;
}

function normalizeUser(user: BackendUser): User {
  return {
    id: String(user.id),
    fullName: user.fullName ?? user.username ?? user.email,
    studentId: user.studentId ?? String(user.id),
    email: user.email,
    role: user.role ?? "student",
  };
}

// True when no backend URL is configured and the in memory mock is used
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
      // Non JSON error body keep the default message.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const httpApi: ApiClient = {
  async register(input: RegisterInput) {
    const { user } = await request<{ user: BackendUser }>("/auth/register", {
      method: "POST",
      body: input,
    });
    return normalizeUser(user);
  },

  async login(input: LoginInput) {
    const { user } = await request<{ user: BackendUser }>("/auth/login", {
      method: "POST",
      body: input,
    });
    return normalizeUser(user);
  },

  async logout() {
    await request<void>("/auth/logout", { method: "POST" });
  },

  async getMe() {
    try {
      const { user } = await request<{ user: BackendUser }>("/users/me");
      return normalizeUser(user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
};

export const api: ApiClient = isMockApi ? mockApi : httpApi;
