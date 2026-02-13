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
    const { quantity, reason, tenBenhNhan, maBenhNhan, tenThuoc } = req.body;

    const userId = req.user?.sub || req.user?.id; // tuỳ middleware set gì
    const idKhoaRoom = req.user?.idKhoa ? String(req.user.idKhoa) : null;

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      {
        $push: {
          returnHistory: {
            quantity,
            reason,
            returnedBy: userId,
            returnedAt: new Date(),
          },
        },
        $set: { updatedBy: userId },
      },
      { new: true }
    );

    // ✅ Emit realtime
    if (global._io && idKhoaRoom) {
      global._io.to(idKhoaRoom).emit("new_notification", {
        type: "RETURN",
        idPhieuKham,
        idPhieuThuoc,
        tenBenhNhan: tenBenhNhan || "Bệnh nhân",
        maBenhNhan: maBenhNhan || "N/A",
        tenThuoc: tenThuoc || "Thuốc",
        soLuongTra: Number(quantity || 0),
        reason: reason || "",
        time: new Date().toISOString(),
      });
      console.log("🚀 [EMIT] new_notification -> room:", idKhoaRoom);
    } else {
      console.log("⚠️ NOT EMIT: missing io or idKhoaRoom", { hasIO: !!global._io, idKhoaRoom });
    }

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

exports.traThuoc = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select("idKhoa");
    const idKhoaRoom = user?.idKhoa?.toString();

    if (global._io && idKhoaRoom) {
      global._io.to(idKhoaRoom).emit("new_notification", {
        tenBenhNhan: req.body.tenBenhNhan,
        maBenhNhan: req.body.maBenhNhan,
        tenThuoc: req.body.tenThuoc,
        soLuongTra: req.body.soLuongTra,
        time: new Date(),
      });
      console.log("🚀 [EMIT] to room:", idKhoaRoom);
    }

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};