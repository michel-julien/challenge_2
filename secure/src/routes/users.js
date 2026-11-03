import express from "express";

import { authorizeUser } from "../middleware/authorize.js";
import { idSchema, validate } from "../middleware/validate.js";
import { publicUser } from "../store.js";

const router = express.Router();

router.get("/me", (request, response) => {
  response.json({ user: publicUser(request.user) });
});

router.get(
  "/:id",
  validate(idSchema, "params"),
  authorizeUser,
  (request, response) => {
    response.json({ user: publicUser(request.targetUser) });
  },
);

export default router;
