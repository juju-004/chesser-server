import { Router } from "express";

import * as controller from "../controllers/pay.controller.js";

const router = Router();

router.route("/").post(controller.initPayment);

router.route("/transactions").get(controller.getTransactionHistory);

router.route("/:reference").get(controller.verifyTransaction);

export default router;
