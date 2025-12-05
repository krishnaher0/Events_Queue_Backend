// Events_Queue_Ba.../config/db.js

import mongoose from 'mongoose';
import 'dotenv/config'; // Make sure this is imported to load .env variables

const connectDB = async () => {
  try {
    // Uses the MONGO_URI variable from your .env file
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully!');
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

export default connectDB;