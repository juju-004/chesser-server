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

const gameSchema = new mongoose.Schema(
  {
    id: { type: Number },
    winner: { type: String, maxlength: 5 },
    endReason: { type: String, maxlength: 16 },
    code: { type: String, maxlength: 7 },
    pgn: { type: String },
    timeControl: { type: Number },
    timer: {
      whiteTime: { type: Number }, // in milliseconds
      blackTime: { type: Number }, // in milliseconds
      lastUpdate: { type: Number }, // timestamp
      activeColor: { type: String, maxlength: 5 },
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

// Create models
export const UserModel = mongoose.model("User", userSchema);
export const GameModel = mongoose.model("Game", gameSchema);
