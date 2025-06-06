import mongoose from "mongoose";

const preferenceSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  theme: {
    type: String,
    enum: [
      "default",
      "classic",
      "blue",
      "brown",
      "dark",
      "green",
      "gray",
      "purple",
      "red",
      "ocean",
      "solarized",
    ],
    default: "default",
  },
  pieceset: {
    type: String,
    enum: ["alpha", "maestro", "cburnett", "merida"],
    default: "cburnett",
  },
  sound: { type: Boolean, default: true },
  autoQueen: { type: Boolean, default: true },
  premove: { type: Boolean, default: true },
});

export const Preference = mongoose.model("Preference", preferenceSchema);
