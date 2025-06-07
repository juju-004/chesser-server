import { Router } from "express";
import * as controller from "../controllers/users.controller.js";

const router = Router();

router.route("/:name").get(controller.getUserData);
router.route("/:name/games/:page").get(controller.getUserGames);
router.route("/:name/players").get(controller.getPlayersByName);

export default router;
