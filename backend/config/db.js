import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://zamrinaufalcode_db_user:qYx9SfMPWPtn4Se6@cluster0.30zmgid.mongodb.net/SwiftyCarRental', {
      // options to improve diagnostics / behavior
      // use the defaults in Mongoose v6+/v7+; explicit options can still help
      serverSelectionTimeoutMS: 10000, // fail fast if can't connect
      socketTimeoutMS: 45000,
    });
    console.log("DB Connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    // Do not crash immediately in dev if you want nodemon to keep running.
    // Optionally exit(1) in production:
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