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
  },
  { timestamps: true }
);

const gameSchema = new mongoose.Schema({
  id: { type: Number },
  winner: { type: String, maxlength: 5 },
  endReason: { type: String, maxlength: 16 },
  code: { type: String, maxlength: 7 },
  pgn: { type: String },
  whiteId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  whiteName: { type: String, maxlength: 32 },
  blackId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  blackName: { type: String, maxlength: 32 },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, default: Date.now },
});

// Create models
export const UserModel = mongoose.model("User", userSchema);
export const GameModel = mongoose.model("Game", gameSchema);
