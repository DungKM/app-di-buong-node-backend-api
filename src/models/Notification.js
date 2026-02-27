const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    idKhoa: { type: mongoose.Schema.Types.ObjectId, ref: "Department", index: true, required: true },
    type: { type: String, default: "RETURN", index: true },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    payload: { type: Object, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);