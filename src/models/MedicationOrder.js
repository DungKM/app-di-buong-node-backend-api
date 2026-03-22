const mongoose = require("mongoose");

const MedicationOrderSchema = new mongoose.Schema(
  {
    idPhieuKham: {
      type: String,
      required: true,
      index: true,
    },

    idPhieuThuoc: {
      type: String,
      required: true,
    },

    tenThuoc: {
      type: String,
      required: true,
      trim: true,
    },

    lieuDung: {
      type: String,
      default: "",
      trim: true,
    },

    soLuong: {
      type: Number,
      default: 0,
      min: 0,
    },

    donVi: {
      type: String,
      default: "",
      trim: true,
    },

    duongDung: {
      type: String,
      default: "",
      trim: true,
    },

    ghiChu: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

MedicationOrderSchema.index(
  { idPhieuKham: 1, idPhieuThuoc: 1 },
  { unique: true }
);

module.exports = mongoose.model("MedicationOrder", MedicationOrderSchema);