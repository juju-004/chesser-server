import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount: Number,
    reference: String,
    status: String,
    channel: String,
    gateway_response: String,
    paid_at: Date,
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const TransactionModel = mongoose.model(
  "Transaction",
  TransactionSchema
);
