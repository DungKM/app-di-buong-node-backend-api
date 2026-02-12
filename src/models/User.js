const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "doctor", "nurse"], required: true },
    idKhoa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
