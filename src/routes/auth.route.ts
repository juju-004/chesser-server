import { Router } from "express";

import * as controller from "../controllers/auth.controller.js";

const router = Router();

router
  .route("/")
  .get(controller.getCurrentSession)
  .patch(controller.updateUser);

router.route("/getuser").get(controller.getCurrentSession);
router.route("/username/:name").get(controller.doesNameExist);
// create or update guest sessions

router.route("/verifymail").post(controller.emailVerification);
router.route("/sendmail").post(controller.sendMail);

router.route("/logout").post(controller.logoutSession);
router.route("/register").post(controller.registerUser);
router.route("/login").post(controller.loginUser);

router.route("/wallet").get(controller.getWallet);

export default router;
