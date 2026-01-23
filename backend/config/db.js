import mongoose from "mongoose";

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is not set. Please configure the environment variable.");
    throw new Error("Missing MONGO_URI environment variable");
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // fail fast if can't connect
      socketTimeoutMS: 45000,
    });
    console.log("DB Connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    // Optionally exit(1) in production if you want a hard fail:
    // process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    console.error("Mongoose connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("Mongoose disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("Mongoose reconnected");
  });
};