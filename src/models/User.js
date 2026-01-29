const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "doctor", "nurse"], required: true },

    // ✅ thêm trường này (không dùng login)
    idKhoa: { type: String, default: null, trim: true },

    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
