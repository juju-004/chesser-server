import mongoose from "mongoose";

// Connect to MongoDB
const mongoURI = process.env.MONGO_URL;

export const connectDatabase = async () => {
  try {
    await mongoose.connect(mongoURI);

    console.log("connected to database");
  } catch (error) {
    console.log(error);
  }
};

// Define schemas for "user" and "game" collections
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    email: { type: String },
    password: { type: String },
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

const gameSchema = new mongoose.Schema(
  {
    id: { type: Number },
    winner: { type: String, maxlength: 5 },
    endReason: { type: String, maxlength: 16 },
    code: { type: String, maxlength: 7 },
    pgn: { type: String },
    timeControl: { type: Number },
    stake: { type: Number },
    timer: {
      white: { type: Number }, // in milliseconds
      black: { type: Number }, // in milliseconds
      lastUpdate: { type: Number }, // timestamp
    },
    chat: { type: Array },
    white: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    black: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: Date.now },
  },
  {
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        // Same transformation for toObject()
        ret.id = ret._id.toString();
        delete ret._id;

        if (ret.white && ret.white._id) {
          ret.white.id = ret.white._id.toString();
          delete ret.white._id;
        }
        if (ret.black && ret.black._id) {
          ret.black.id = ret.black._id.toString();
          delete ret.black._id;
        }

        return ret;
      },
    },
  }
);

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

const friendRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const FriendRequest = mongoose.model(
  "FriendRequest",
  friendRequestSchema
);
export const UserModel = mongoose.model("User", userSchema);
export const GameModel = mongoose.model("Game", gameSchema);
export const TransactionModel = mongoose.model(
  "Transaction",
  TransactionSchema
);
