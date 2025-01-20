const mongoose = require("mongoose");
const env = require("dotenv").config();
const User = require('../model/userSchema'); // Import your User model

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("DB connected");

    // Sync indexes after DB connection
    await User.syncIndexes();
    console.log("Indexes synchronized");
  } catch (error) {
    console.log("DB CONNECTION ERROR", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;