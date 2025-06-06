import mongoose from "mongoose";

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

export const GameModel = mongoose.model("Game", gameSchema);
