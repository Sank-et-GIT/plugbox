const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Skip MongoDB connection since we're using Prisma with PostgreSQL
    console.log("Using Prisma with PostgreSQL - MongoDB connection skipped");
    return true;
  } catch (error) {
    console.error("Database Connection Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
