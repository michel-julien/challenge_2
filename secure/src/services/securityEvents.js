import { logger } from "./logger.js";

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOCK_DURATION_MS = 10 * 60 * 1000;
const loginFailures = new Map();

export function recordLoginFailure(identifier) {
  const now = Date.now();
  const previous = loginFailures.get(identifier);
  const state =
    previous && now - previous.firstAttempt < FAILURE_WINDOW_MS
      ? previous
      : { count: 0, firstAttempt: now, lockedUntil: 0 };

  state.count += 1;

  if (state.count >= MAX_FAILURES) {
    state.lockedUntil = now + LOCK_DURATION_MS;
    logger.warn({ identifier }, "Login temporarily locked");
  }

  loginFailures.set(identifier, state);
  logger.warn({ identifier, count: state.count }, "Login failed");
}

export function isLoginLocked(identifier) {
  const state = loginFailures.get(identifier);

  if (!state || state.lockedUntil <= Date.now()) {
    return false;
  }
  return true;
}

export function recordLoginSuccess(identifier) {
  loginFailures.delete(identifier);
}

export function resetSecurityEvents() {
  loginFailures.clear();
}

export function recordAccessDenied(user, resource) {
  logger.warn(
    { userId: user.id, role: user.role, resource },
    "Access denied",
  );
}

export function recordUploadRejected(user, filename) {
  logger.warn(
    { userId: user?.id, filename },
    "Upload rejected",
  );
}
