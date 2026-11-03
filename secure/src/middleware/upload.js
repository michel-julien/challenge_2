import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fileTypeFromBuffer } from "file-type";
import multer from "multer";

import { createHttpError } from "./errorHandler.js";
import { recordUploadRejected } from "../services/securityEvents.js";

const sourceDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const quarantineDirectory = path.join(sourceDirectory, "quarantine");
const uploadDirectory = path.join(sourceDirectory, "uploads");
const allowedTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".pdf", "application/pdf"],
]);

await mkdir(quarantineDirectory, { recursive: true });
await mkdir(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, quarantineDirectory);
  },
  filename: (_request, file, callback) => {
    callback(
      null,
      `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
    );
  },
});

function fileFilter(request, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMime = allowedTypes.get(extension);

  if (!expectedMime || file.mimetype !== expectedMime) {
    recordUploadRejected(request.user, file.originalname);
    return callback(createHttpError(400, "Unsupported file type"));
  }

  return callback(null, true);
}

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});

export async function validateAndStoreFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMime = allowedTypes.get(extension);
  const content = await readFile(file.path);
  const detectedType = await fileTypeFromBuffer(content);

  if (!detectedType || detectedType.mime !== expectedMime) {
    await rm(file.path, { force: true });
    throw createHttpError(400, "File content does not match its extension");
  }

  const fileId = path.parse(file.filename).name;
  const storedName = `${fileId}${extension}`;
  const finalPath = path.join(uploadDirectory, storedName);
  await rename(file.path, finalPath);

  return {
    id: fileId,
    originalName: path.basename(file.originalname),
    storedName,
    path: finalPath,
    mimetype: detectedType.mime,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}
