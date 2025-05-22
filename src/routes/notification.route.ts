import { Router } from "express";

import * as controller from "../controllers/notification.controller.js";

const router = Router();

router
  .route("/")
  .get(controller.getUserNotifications)
  .delete(controller.clearNotifications);

export default router;
