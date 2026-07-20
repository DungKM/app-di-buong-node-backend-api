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
    confirmedShifts: {
      type: [String],
      enum: ["MORNING", "NOON", "AFTERNOON", "NIGHT"],
      default: [],
    },
    confirmationHistory: [
      {
        idKhoa: { type: String, default: null },
        idBenhNhan: { type: String, default: null },
        tenBenhNhan: { type: String, default: null },
        maBenhNhan: { type: String, default: null },
        tuoi: { type: String, default: null },
        tenThuoc: { type: String, default: null },
        hamLuong: { type: String, default: null },
        loaiThuoc: { type: String, default: null },
        donVi: { type: String, default: null },
        soLuongDung: { type: Number, default: 0 },
        shift: {
          type: String,
          enum: ["MORNING", "NOON", "AFTERNOON", "NIGHT"],
          required: true,
        },
        confirmedAt: { type: Date, default: Date.now },
        confirmedBy: { type: String, default: null },
      }
    ],
    returnHistory: [
      {
        idKhoa: { type: String, default: null },
        idBenhNhan: { type: String, default: null },
        tenBenhNhan: { type: String, default: null },
        maBenhNhan: { type: String, default: null },
        tuoi: { type: String, default: null },
        tenThuoc: { type: String, default: null },
        hamLuong: { type: String, default: null },
        loaiThuoc: { type: String, default: null },
        donVi: { type: String, default: null },
        quantity: { type: Number, required: true },
        reason: { type: String, required: true },
        shift: {
          type: String,
          enum: ["MORNING", "NOON", "AFTERNOON", "NIGHT"],
          required: true,
        },
        status: { type: String, default: "Đã trả thuốc" },
        returnedAt: { type: Date, default: Date.now },
        returnedBy: { type: String },
      }
    ],

    status: { type: String, default: "Chờ dùng thuốc" },
    updatedBy: { type: String, default: null },

    splitSource: {
      type: String,
      enum: ["MANUAL", "RULE", "AI"],
      default: "MANUAL",
    },

    confidence: {
      type: Number,
      default: 1,
      min: 0,
      max: 1,
    },

    needsReview: {
      type: Boolean,
      default: false,
    },

    reason: {
      type: String,
      default: null,
    },

    rawInstruction: {
      type: String,
      default: null,
    },

    parsedInstruction: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

MedShiftSplitSchema.index({ idPhieuKham: 1, idPhieuThuoc: 1 }, { unique: true });
MedShiftSplitSchema.index({ "confirmationHistory.idKhoa": 1, "confirmationHistory.confirmedAt": -1 });
MedShiftSplitSchema.index({ "returnHistory.idKhoa": 1, "returnHistory.returnedAt": -1 });

module.exports = mongoose.model("MedShiftSplit", MedShiftSplitSchema);

