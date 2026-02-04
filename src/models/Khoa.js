const mongoose = require("mongoose");

const khoaSchema = new mongoose.Schema(
  {
    idKhoa: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    tenKhoa: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    maKhoa: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Khoa", khoaSchema);
