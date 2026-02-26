const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema(
  {
    idPhieuKham: { type: String, required: true },
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Note", NoteSchema);