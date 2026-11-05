export const sessionCookieName = "campus_session";

function cookieValue(request) {
  const cookieHeader = request.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));

  return cookie
    ? decodeURIComponent(cookie.slice(sessionCookieName.length + 1))
    : null;
}

export function readSessionCookie(request) {
  return cookieValue(request);
}

export function serializeSessionCookie(token) {
  const attributes = [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function serializeClearedSessionCookie() {
  return [
    `${sessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}
