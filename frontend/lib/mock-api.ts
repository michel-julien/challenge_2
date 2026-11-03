// In-memory mock of the CampusAPI backend, used when NEXT_PUBLIC_API_URL is
// not set so the UI can be developed without a running server.
// State lives in memory only: reloading the page resets the "session".
import {
  ApiError,
  type ApiClient,
  type LoginInput,
  type RegisterInput,
  type User,
} from "./api-types";

const DELAY_MS = 400;

interface StoredUser extends User {
  password: string;
}

const users: StoredUser[] = [
  {
    id: "1",
    fullName: "Demo Student",
    studentId: "S1234567",
    email: "demo@campus.edu",
    role: "student",
    password: "password123",
  },
];

let sessionUserId: string | null = null;
let nextId = 2;

function delay() {
  return new Promise((resolve) => setTimeout(resolve, DELAY_MS));
}

function toPublicUser(u: StoredUser): User {
  return {
    id: u.id,
    fullName: u.fullName,
    studentId: u.studentId,
    email: u.email,
    role: u.role,
  };
}

export const mockApi: ApiClient = {
  async register(input: RegisterInput) {
    await delay();
    const email = input.email.trim().toLowerCase();
    const studentId = input.studentId.trim();
    if (
      users.some((u) => u.email === email || u.studentId === studentId)
    ) {
      throw new ApiError(409, "Registration failed");
    }
    const user: StoredUser = {
      id: String(nextId++),
      fullName: input.fullName.trim(),
      studentId,
      email,
      role: "student",
      password: input.password,
    };
    users.push(user);
    return toPublicUser(user);
  },

  async login(input: LoginInput) {
    await delay();
    const email = input.email.trim().toLowerCase();
    const user = users.find(
      (u) => u.email === email && u.password === input.password,
    );
    if (!user) throw new ApiError(401, "Invalid email or password");
    sessionUserId = user.id;
    return toPublicUser(user);
  },

  async logout() {
    await delay();
    sessionUserId = null;
  },

  async getMe() {
    await delay();
    const user = users.find((u) => u.id === sessionUserId);
    return user ? toPublicUser(user) : null;
  },
};
