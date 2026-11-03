// Shared types for the CampusAPI client. These mirror API_CONTRACT.md.

export type UserRole = "student" | "staff" | "admin";

export interface User {
  id: string;
  fullName: string;
  studentId: string;
  email: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  fullName: string;
  studentId: string;
  email: string;
  password: string;
}

/** The interface implemented by both the real HTTP client and the mock. */
export interface ApiClient {
  register(input: RegisterInput): Promise<User>;
  login(input: LoginInput): Promise<User>;
  logout(): Promise<void>;
  /** Returns the current user, or null when there is no valid session (401). */
  getMe(): Promise<User | null>;
}

/** Thrown for any failed request. `status` is 0 for network errors. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
