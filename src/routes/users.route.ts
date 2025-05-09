import { Router } from "express";
import * as controller from "../controllers/users.controller.js";
import * as controllers from "../controllers/auth.controller.js";

const router = Router();

router.route("/:name").get(controllers.getUserProfile);

router.route("/:name/games").get(controller.getUserGames);

router.route("/:name/friends").get(controller.getUserFriends);

router.route("/friend").post(controller.addFriend);
router.route("/friends/:friendId").delete(controller.removeFriend);

router.route("/block").post(controller.blockUser);
router.route("/blocked/:userId").delete(controller.unBlockUser);

export default router;
