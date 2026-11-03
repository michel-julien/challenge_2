import path from "node:path";
import express from "express";

import { randomUUID } from "node:crypto";
import { files } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.post("/", authenticate, upload.single("file"), (request, response) => {
  const file = {
    id: randomUUID(),
    ownerId: request.userId,
    originalName: request.file.originalname,
    storedName: request.file.filename,
    path: request.file.path,
    mimetype: request.file.mimetype,
    size: request.file.size,
    uploadedAt: new Date().toISOString(),
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
});

router.get("/:id", (request, response, next) => {
  const file = files.get(request.params.id);

  if (!file) {
    return response.status(404).json({ error: "File not found" });
  }

  return response.sendFile(path.resolve(file.path), (error) => {
    if (error && !response.headersSent) {
      next(error);
    }
  });
});

export default router;
