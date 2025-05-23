import { Router } from "express";

import auth from "./auth.route.js";
import games from "./games.route.js";
import users from "./users.route.js";
import pay from "./pay.route.js";
import notification from "./notification.route.js";
import friends from "./friends.route.js";

const router = Router();

router.use("/games", games);
router.use("/user", users);
router.use("/auth", auth);
router.use("/pay", pay);
router.use("/notification", notification);
router.use("/friends", friends);

export default router;
