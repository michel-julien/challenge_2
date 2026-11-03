import { rm } from "node:fs/promises";
import express from "express";

import { authorizeFile } from "../middleware/authorize.js";
import { createHttpError } from "../middleware/errorHandler.js";
import {
  upload,
  validateAndStoreFile,
} from "../middleware/upload.js";
import { idSchema, validate } from "../middleware/validate.js";
import { files } from "../store.js";

const router = express.Router();

router.post("/", upload.single("file"), async (request, response, next) => {
  if (!request.file) {
    return next(createHttpError(400, "A file is required"));
  }

  try {
    const storedFile = await validateAndStoreFile(request.file);
    const file = {
      ...storedFile,
      ownerId: request.user.id,
    };

    files.set(file.id, file);

    return response.status(201).json({
      file: {
        id: file.id,
        ownerId: file.ownerId,
        originalName: file.originalName,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: file.uploadedAt,
      },
    });
  } catch (error) {
    if (request.file.path) {
      await rm(request.file.path, { force: true });
    }
    return next(error);
  }
});

router.get(
  "/:id",
  validate(idSchema, "params"),
  authorizeFile,
  (request, response, next) => {
    response.sendFile(request.targetFile.path, (error) => {
      if (error && !response.headersSent) {
        next(error);
      }
    });
  },
);

export default router;
