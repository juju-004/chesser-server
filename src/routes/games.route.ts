import { Router } from "express";

import * as controller from "../controllers/games.controller.js";

const router = Router();

router.route("/").post(controller.createGame);

router.route("/:code").get(controller.getGame);

export default router;
