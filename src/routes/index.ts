import { Router } from "express";

import auth from "./auth.route.js";
import games from "./games.route.js";
import users from "./users.route.js";
import pay from "./pay.route.js";

const router = Router();

router.use("/games", games);
router.use("/user", users);
router.use("/auth", auth);
router.use("/pay", pay);

export default router;
