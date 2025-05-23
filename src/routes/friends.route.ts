import { Router } from "express";
import * as controller from "../controllers/friends.controller.js";

const router = Router();

router.route("/:id").get(controller.getUserFriends).delete(controller.unFriend);

export default router;
