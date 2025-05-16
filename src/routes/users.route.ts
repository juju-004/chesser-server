import { Router } from "express";
import * as controller from "../controllers/users.controller.js";

const router = Router();

router.route("/:name").get(controller.getUserProfile);

router.route("/:name/games").get(controller.getUserGames);

router.route("/players/:name").get(controller.getPlayersByName);

router.route("/:name/friends").get(controller.getUserFriends);

router.route("/sendfriendreq").post(controller.sendFriendReq);
router.route("/acceptfriendreq").post(controller.acceptFriendReq);
router.route("/friends/:friendId").delete(controller.removeFriend);

export default router;
