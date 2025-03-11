const mongoose = require("mongoose");
require("dotenv").config();
const User = require('../model/userSchema'); // Import your User model

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("DB connected to Atlas");

    // Sync indexes after DB connection
    await User.syncIndexes();
    console.log("Indexes synchronized");
  } catch (error) {
    console.log("DB CONNECTION ERROR", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;