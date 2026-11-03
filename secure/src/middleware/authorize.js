import { files, users } from "../store.js";
import { createHttpError } from "./errorHandler.js";
import { recordAccessDenied } from "../services/securityEvents.js";

export function authorizeUser(request, _response, next) {
  const targetUser = users.get(request.params.id);

  if (!targetUser) {
    return next(createHttpError(404, "User not found"));
  }

  if (request.user.role !== "admin" && request.user.id !== targetUser.id) {
    recordAccessDenied(request.user, `/users/${request.params.id}`);
    return next(createHttpError(403, "You cannot access this user"));
  }

  request.targetUser = targetUser;
  return next();
}

export function authorizeFile(request, _response, next) {
  const file = files.get(request.params.id);

  if (!file) {
    return next(createHttpError(404, "File not found"));
  }

  if (request.user.role !== "admin" && request.user.id !== file.ownerId) {
    recordAccessDenied(request.user, `/files/${request.params.id}`);
    return next(createHttpError(403, "You cannot access this file"));
  }

  request.targetFile = file;
  return next();
}
