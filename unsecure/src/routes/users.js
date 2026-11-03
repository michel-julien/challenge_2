import express from "express";

import { publicUser, users } from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/me", authenticate, (request, response) => {
  const user = users.get(request.userId);

  if (!user) {
    return response.status(404).json({ error: "User not found" });
  }

  return response.json({ user: publicUser(user) });
});

router.get("/:id", authenticate, (request, response) => {
  const user = users.get(request.params.id);

  if (!user) {
    return response.status(404).json({ error: "User not found" });
  }

  return response.json({ user: publicUser(user) });
});

export default router;
