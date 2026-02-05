const mongoose = require("mongoose");

const MedShiftSplitSchema = new mongoose.Schema(
  {
    idPhieuKham: { type: String, required: true },
    idPhieuThuoc: { type: String, required: true },

    splits: {
      MORNING: { type: Number, default: 0 },
      NOON: { type: Number, default: 0 },
      AFTERNOON: { type: Number, default: 0 },
      NIGHT: { type: Number, default: 0 },
    },

    returnHistory: [
      {
        quantity: { type: Number, required: true }, 
        reason: { type: String, required: true },  
        status: { type: String, default: "Đã trả thuốc" },
        returnedAt: { type: Date, default: Date.now },
        returnedBy: { type: String },
      }
    ],

    status: { type: String, default: "Chờ dùng thuốc" },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

MedShiftSplitSchema.index({ idPhieuKham: 1, idPhieuThuoc: 1 }, { unique: true });

module.exports = mongoose.model("MedShiftSplit", MedShiftSplitSchema);