import { Request, Response } from "express";
import { asyncHandler } from "../db/helper.js";
import axios from "axios";
import { TransactionModel, UserModel } from "../db/index.js";

export const initPayment = asyncHandler(async (req: Request, res: Response) => {
  const id = req.session?.user?.id;
  if (!id) throw Error("Invalid Request");

  const { email, amount } = req.body;

  const response = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email,
      amount: amount * 100, // Paystack uses kobo
      callback_url: `${process.env.CLIENT_URL}/pay/transactions`, // your frontend redirect URL
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );

  await TransactionModel.create({
    user: req.session.user.id, // you must retrieve this from token/session
    amount: amount,
    reference: response.data.data.reference,
  });

  res.json({ authorization_url: response.data.data.authorization_url });
}, true);

export const verifyTransaction = asyncHandler(
  async (req: Request, res: Response) => {
    const { reference } = req.params;

    // Find transaction by reference
    const transaction = await TransactionModel.findOne({ reference });

    // If transaction doesn't exist or already verified
    if (!transaction) throw Error("Transaction not found");
    if (transaction.verified) throw Error("Transaction already verified");

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        },
      }
    );
    const data = response.data.data;
    transaction.verified = true;
    transaction.channel = data.channel;
    transaction.gateway_response = data.gateway_response;
    transaction.paid_at = data.paid_at;

    if (data.status === "success") {
      // Mark the transaction as verified
      transaction.status = "success";

      await transaction.save();

      const updatedUser = await UserModel.updateOne(
        { _id: req.session.user.id },
        { $inc: { wallet: data.amount / 100 } }
      );

      if (!updatedUser) throw new Error("User not found");

      const transactions = await TransactionModel.find({
        user: req.session.user.id,
      }).sort({
        createdAt: -1,
      });

      res.json(transactions);
      return;
    }

    if (data.status === "abandoned") {
      // Mark the transaction as verified
      transaction.status = "failed";

      await transaction.save();

      const transactions = await TransactionModel.find({
        user: req.session.user.id,
      }).sort({
        createdAt: -1,
      });

      res.json(transactions);
      return;
    }

    throw Error("Invalid Request");
  },
  true
);

export const getTransactionHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.session?.user?.id;
    if (!id) throw Error("Invalid request");

    const transactions = await TransactionModel.find({ user: id }).sort({
      createdAt: -1,
    });

    res.json(transactions);
  },
  true
);
