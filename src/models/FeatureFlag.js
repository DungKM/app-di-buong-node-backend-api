const mongoose = require("mongoose");

const toggleHistorySchema = new mongoose.Schema(
  {
    isEnabled: { type: Boolean, required: true },
    reason: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedByUsername: { type: String },
  },
  { _id: false, timestamps: { createdAt: "changedAt", updatedAt: false } }
);

const FeatureFlagSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    isEnabled: { type: Boolean, default: false },
    toggleHistory: { type: [toggleHistorySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeatureFlag", FeatureFlagSchema);
