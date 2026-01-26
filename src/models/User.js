const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "doctor", "nurse"], required: true },
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [String], default: [] }, // whitelist refresh token
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
