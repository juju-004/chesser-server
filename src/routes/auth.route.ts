import { Router } from "express";

import * as controller from "../controllers/auth.controller.js";

const router = Router();

router
  .route("/")
  .get(controller.getCurrentSession)
  .patch(controller.updateUser);

router.route("/getuser").get(controller.getCurrentSession);
// create or update guest sessions

router.route("/user/:name").get(controller.getUserProfile);

router.route("/verifymail").post(controller.emailVerification);
router.route("/resendmail").post(controller.resendMail);

// forgot password
router.route("/forgotpassmailsend").post(controller.forgotPassEmailSend);
router
  .route("/forgotpassmailverify")
  .post(controller.forgotPassEmailVerification);

router.route("/logout").post(controller.logoutSession);
router.route("/register").post(controller.registerUser);
router.route("/login").post(controller.loginUser);

router.route("/wallet").get(controller.getWallet);

export default router;
