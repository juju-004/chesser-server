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
