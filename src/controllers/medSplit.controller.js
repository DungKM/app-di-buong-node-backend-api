const MedShiftSplit = require("../models/MedShiftSplit");

exports.list = async (req, res) => {
  try {
    const { idPhieuKham } = req.params;
    const rows = await MedShiftSplit.find({ idPhieuKham });

    const map = {};
    rows.forEach((r) => {
      map[r.idPhieuThuoc] = {
        splits: r.splits,
        status: r.status,
        returnHistory: r.returnHistory
      };
    });

    return res.json({ idPhieuKham, splits: map });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.saveOne = async (req, res) => {
  const { idPhieuKham, idPhieuThuoc } = req.params;
  const { splits } = req.body;
  const userId = req.user?.id;

  const updated = await MedShiftSplit.findOneAndUpdate(
    { idPhieuKham, idPhieuThuoc },
    {
      $set: {
        splits,
        updatedBy: userId,
        status: "Chờ dùng thuốc"
      }
    },
    { upsert: true, new: true }
  );

  return res.json(updated);
};

exports.confirmUsage = async (req, res) => {
  try {
    const { idPhieuKham, idPhieuThuoc } = req.params;
    const userId = req.user?.id;

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      { $set: { status: "Đã dùng thuốc", updatedBy: userId } },
      { new: true }
    );

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PATCH Trả thuốc (Hủy số lượng kèm lý do)
exports.returnMedication = async (req, res) => {
  try {
    const { idPhieuKham, idPhieuThuoc } = req.params;
    const { quantity, reason } = req.body;
    const userId = req.user?.id;

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      {
        $push: {
          returnHistory: {
            quantity,
            reason,
            returnedBy: userId,
            returnedAt: new Date()
          }
        },
        $set: { updatedBy: userId }
      },
      { new: true }
    );

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// PUT save batch nhiều thuốc (Giữ nguyên logic cũ nhưng thêm status)
exports.saveBatch = async (req, res) => {
  const { idPhieuKham } = req.params;
  const { items } = req.body;
  const userId = req.user?.id;

  for (const it of items) {
    await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc: it.idPhieuThuoc },
      {
        $set: {
          splits: it.splits,
          updatedBy: userId,
          status: "Chờ dùng thuốc"
        }
      },
      { upsert: true, new: true }
    );
  }

  return res.json({ ok: true });
};