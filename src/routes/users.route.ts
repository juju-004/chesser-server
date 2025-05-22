import { Router } from "express";
import * as controller from "../controllers/users.controller.js";

const router = Router();

router.route("/friends/:friendId").delete(controller.unFriend);

router.route("/players/:name").get(controller.getPlayersByName);

router.route("/data/:name").get(controller.getUserData);

router.route("/:name").get(controller.getUserProfile);
router.route("/:name/games").get(controller.getUserGames);
router.route("/:name/friends").get(controller.getUserFriends);

export default router;
