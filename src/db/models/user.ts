import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    token: { type: String },
    wallet: { type: Number, default: 0 },
    forgotPassPassword: { type: String },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

userSchema.virtual("transactions", {
  ref: "Transaction", // the model to use
  localField: "_id", // the field on the user
  foreignField: "user", // the field on the transaction that refers to user
});

export const UserModel = mongoose.model("User", userSchema);
