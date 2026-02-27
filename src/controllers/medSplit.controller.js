const MedShiftSplit = require("../models/MedShiftSplit");
const Notification = require("../models/Notification");

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

exports.returnMedication = async (req, res) => {
  try {
    const { idPhieuKham, idPhieuThuoc } = req.params;
    const { quantity, reason, tenBenhNhan, maBenhNhan, tenThuoc } = req.body;

    const userId = req.user?.id || req.user?.sub;
    const idKhoaRoom = req.user?.idKhoa?.toString?.() || req.user?.idKhoa;

    const safeTen = tenBenhNhan || "Bệnh nhân";
    const safeMa = maBenhNhan || "N/A";
    const safeThuoc = tenThuoc || "Thuốc";
    const safeQty = quantity || 0;
    const safeReason = reason || "";

    const qs = new URLSearchParams({
      maBenhNhan: safeMa,
      tenBenhNhan: safeTen,
    }).toString();

    const redirectUrl = `/medication/${idPhieuKham}?${qs}`;

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      {
        $push: {
          returnHistory: { quantity: safeQty, reason: safeReason, returnedBy: userId, returnedAt: new Date() },
        },
        $set: { updatedBy: userId },
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Không tìm thấy phiếu thuốc" });

    const notiPayload = {
      type: "RETURN",
      idPhieuKham,
      idPhieuThuoc,
      tenBenhNhan: safeTen,
      maBenhNhan: safeMa,
      tenThuoc: safeThuoc,
      soLuongTra: safeQty,
      reason: safeReason,
      url: redirectUrl,
    };

    if (idKhoaRoom) {
      const noti = await Notification.create({
        idKhoa: idKhoaRoom,
        type: "RETURN",
        title: "Trả thuốc",
        body: `BN ${safeTen} trả ${safeQty} ${safeThuoc}`,
        payload: notiPayload,
        createdBy: userId || null,
      });

      if (global._io) {
        global._io.to(idKhoaRoom).emit("new_notification", {
          _id: noti._id,
          ...notiPayload,
          createdAt: noti.createdAt,
          read: false,
        });
      }
    }

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

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