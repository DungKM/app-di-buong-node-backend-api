const mongoose = require("mongoose");

const XmlReceiveSchema = new mongoose.Schema(
  {
    xmlBase64: {
      type: String,
    },
    rawXml: {
      type: String,
    },
    parsedData: {
      type: mongoose.Schema.Types.Mixed,
    },
    callerIp: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    // 'parsed' nếu xml parse thành công, 'error' nếu base64 hoặc xml không hợp lệ
    status: {
      type: String,
      enum: ["parsed", "error"],
      required: true,
    },
    parseError: {
      type: String,
    },
  },
  { timestamps: true }
);

XmlReceiveSchema.index({ createdAt: -1 });
XmlReceiveSchema.index({ status: 1 });

module.exports = mongoose.model("XmlReceive", XmlReceiveSchema);
