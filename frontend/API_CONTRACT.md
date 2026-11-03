# CampusAPI — Frontend ↔ Backend API Contract

This is exactly what the frontend (`lib/api.ts`) expects from the backend.
The frontend runs at `http://localhost:3000` (`pnpm dev`) or
`http://localhost:5000` (Docker). The backend base URL is configured with
`NEXT_PUBLIC_API_URL` (e.g. `http://localhost:5001`).

## General rules

- All request and response bodies are JSON (`Content-Type: application/json`).
- Every request is sent with `credentials: "include"`, so the browser sends and
  receives the session cookie cross-origin.
- **Errors** always use this shape, with an appropriate 4xx/5xx status:

  ```json
  { "error": "Human readable message" }
  ```

  The frontend only shows generic messages to the user (e.g. "Invalid email or
  password"), so error strings should not leak internals (stack traces, SQL,
  whether an email exists, …).
- Unknown/extra fields in request bodies should be ignored or rejected; the
  backend must **validate every input itself** (client-side validation is only
  for UX).

## User object

```json
{
  "id": "1",
  "fullName": "Demo Student",
  "studentId": "S1234567",
  "email": "demo@campus.edu",
  "role": "student"
}
```

| Field       | Type   | Notes                                   |
| ----------- | ------ | --------------------------------------- |
| `id`        | string | Stable unique id (string, even if numeric in the DB) |
| `fullName`  | string |                                         |
| `studentId` | string | Unique                                  |
| `email`     | string | Unique, compared case-insensitively     |
| `role`      | string | `"student"` \| `"staff"` \| `"admin"`; new registrations are always `"student"` |

Never include the password or password hash in any response.

## Session (cookie-based)

- On successful login the backend sets an **httpOnly** session cookie, e.g.
  `Set-Cookie: sid=<random>; HttpOnly; Path=/; SameSite=Lax` (add `Secure`
  when served over HTTPS).
- The frontend never reads or stores tokens (no localStorage); it relies only
  on the cookie.
- `localhost:3000` and `localhost:5001` are the same *site* (ports don't
  matter for SameSite), so `SameSite=Lax` works locally.

## CORS

Allow credentialed requests from the frontend origins only (no `*`):

```
Access-Control-Allow-Origin: http://localhost:3000   (or http://localhost:5000 — echo the matching allowed origin)
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept
Vary: Origin
```

Preflight `OPTIONS` requests must be answered (the frontend sends
`Content-Type: application/json` on POST bodies).

## Endpoints

### `POST /api/auth/register`

Request:

```json
{ "fullName": "Jane Doe", "studentId": "S7654321", "email": "jane@campus.edu", "password": "at-least-8-chars" }
```

| Status | Body                | When                                            |
| ------ | ------------------- | ----------------------------------------------- |
| 201    | `{ "user": User }`  | Account created                                 |
| 400    | `{ "error": "…" }`  | Validation failed (missing fields, bad email, password < 8 chars) |
| 409    | `{ "error": "…" }`  | Email or student ID already in use              |

Registration does **not** need to start a session: the frontend calls
`POST /api/auth/login` with the same credentials right after a 201.

### `POST /api/auth/login`

Request:

```json
{ "email": "demo@campus.edu", "password": "password123" }
```

| Status | Body                                     | When                    |
| ------ | ---------------------------------------- | ----------------------- |
| 200    | `{ "user": User }` + `Set-Cookie` (httpOnly session) | Valid credentials |
| 400    | `{ "error": "…" }`                       | Malformed body          |
| 401    | `{ "error": "Invalid email or password" }` | Wrong email **or** password (same response for both) |

### `POST /api/auth/logout`

No body.

| Status | Body | When                                                   |
| ------ | ---- | ------------------------------------------------------ |
| 204    | —    | Always (even without a session); destroys the session and clears the cookie |

### `GET /api/users/me`

Called by the frontend on every page load to restore the session.

| Status | Body               | When                               |
| ------ | ------------------ | ---------------------------------- |
| 200    | `{ "user": User }` | Valid session cookie               |
| 401    | `{ "error": "…" }` | No cookie, or invalid/expired session |

## Demo account

The frontend's mock mode seeds `demo@campus.edu` / `password123`
(student ID `S1234567`). Seeding the same user in the backend keeps both modes
consistent.
