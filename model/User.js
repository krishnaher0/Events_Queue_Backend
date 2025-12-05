// Events_Queue_Ba.../model/User.js

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // ✨ NEW: Role management field
  role: { 
    type: String, 
    required: true, 
    enum: ['admin', 'organizer', 'user'], // Restricts role to these specific values
    default: 'user' // Sets 'user' as the default role for new signups
  },

  // You might add phone number here if needed:
  // phone: { type: String }, 
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// ---

// **Pre-Save Hook (for Signup):** Hash password before saving to DB
UserSchema.pre('save', async function () { 
  // Only run this function if password was actually modified
  if (!this.isModified('password')) {
    // If you need to stop the chain, simply return here
    return; 
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ---

// **Method (for Login):** Compare user-entered password with the hashed password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  // Compares the entered password with 'this.password' (the hashed one in the DB)
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);
export default User;