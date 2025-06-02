import { Router } from "express";

import * as controller from "../controllers/preference.controller.js";

const router = Router();

router
  .route("/")
  .get(controller.getUserPreference)
  .patch(controller.updatePreference);

export default router;
