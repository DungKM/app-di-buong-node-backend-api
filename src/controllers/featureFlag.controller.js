const FeatureFlag = require("../models/FeatureFlag");

exports.list = async (req, res) => {
  try {
    const flags = await FeatureFlag.find().sort({ code: 1 }).select("-toggleHistory");
    res.json({ success: true, data: flags });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getByCode = async (req, res) => {
  try {
    const flag = await FeatureFlag.findOne({ code: req.params.code.toUpperCase() });
    if (!flag) return res.status(404).json({ success: false, message: "Không tìm thấy config" });
    res.json({ success: true, data: flag });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { code, name, description, isEnabled, reason } = req.body;

    const existing = await FeatureFlag.findOne({ code });
    if (existing) return res.status(400).json({ success: false, message: "Mã config đã tồn tại" });

    const flag = await FeatureFlag.create({
      code,
      name,
      description,
      isEnabled,
      toggleHistory: [
        {
          isEnabled,
          reason,
          changedBy: req.user.sub,
          changedByUsername: req.user.username,
        },
      ],
    });

    res.status(201).json({ success: true, data: flag });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, description } = req.body;
    const flag = await FeatureFlag.findOneAndUpdate(
      { code: req.params.code.toUpperCase() },
      { name, description },
      { new: true, runValidators: true }
    );
    if (!flag) return res.status(404).json({ success: false, message: "Không tìm thấy config" });
    res.json({ success: true, data: flag });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggle = async (req, res) => {
  try {
    const { isEnabled, reason } = req.body;
    const flag = await FeatureFlag.findOne({ code: req.params.code.toUpperCase() });
    if (!flag) return res.status(404).json({ success: false, message: "Không tìm thấy config" });

    flag.isEnabled = isEnabled;
    flag.toggleHistory.push({
      isEnabled,
      reason,
      changedBy: req.user.sub,
      changedByUsername: req.user.username,
    });
    await flag.save();

    res.json({ success: true, data: flag });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const flag = await FeatureFlag.findOneAndDelete({ code: req.params.code.toUpperCase() });
    if (!flag) return res.status(404).json({ success: false, message: "Không tìm thấy config" });
    res.json({ success: true, message: "Đã xóa config" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
