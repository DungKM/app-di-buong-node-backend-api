const MedShiftSplit = require("../models/MedShiftSplit");
const Notification = require("../models/Notification");
const { suggestSplitFromInstruction } = require("../services/medSplitSuggestion.service");


exports.list = async (req, res) => {
  try {
    const { idPhieuKham } = req.params;
    const rows = await MedShiftSplit.find({ idPhieuKham });

    const map = {};
    rows.forEach((r) => {
      map[r.idPhieuThuoc] = {
        splits: r.splits,
        status: r.status,
        returnHistory: r.returnHistory,
        splitSource: r.splitSource,
        confidence: r.confidence,
        needsReview: r.needsReview,
        reason: r.reason,
        rawInstruction: r.rawInstruction,
        parsedInstruction: r.parsedInstruction,
        confirmedShifts: r.confirmedShifts ?? [],
      };
    });

    return res.json({ idPhieuKham, splits: map });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.saveOne = async (req, res) => {
  try {
    const { idPhieuKham, idPhieuThuoc } = req.params;
    const { splits } = req.body;
    const userId = req.user?.id;

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      {
        $set: {
          splits,
          updatedBy: userId,
          status: "Chờ dùng thuốc",
          splitSource: "MANUAL",
          confidence: 1,
          needsReview: false,
          reason: null,
        }
      },
      { upsert: true, new: true }
    );

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.confirmUsage = async (req, res) => {
  const { idPhieuKham, idPhieuThuoc } = req.params;
  const { shift } = req.body;
  const userId = req.user?.id;

  console.log("=== confirmUsage ===");
  console.log("body:", req.body);
  console.log("shift:", shift);

  // 👇 Thử tìm document trước xem có tồn tại không
  const existing = await MedShiftSplit.findOne({ idPhieuKham, idPhieuThuoc });
  console.log("existing doc:", existing);

  const updated = await MedShiftSplit.findOneAndUpdate(
    { idPhieuKham, idPhieuThuoc },
    {
      $addToSet: { confirmedShifts: shift },
      $set: { updatedBy: userId },
    },
    { new: true }
  );

  console.log("updated:", JSON.stringify(updated, null, 2));

  return res.json(updated);
};

exports.returnMedication = async (req, res) => {
  try {
    const { idPhieuKham, idPhieuThuoc } = req.params;
    const {
      quantity,
      reason,
      tenBenhNhan,
      maBenhNhan,
      tenThuoc,
      idBenhAn,
      shift
    } = req.body;

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
      idPhieuKham,
    }).toString();

    const redirectUrl = `/medication/${idBenhAn}?${qs}`;

    const updated = await MedShiftSplit.findOneAndUpdate(
      { idPhieuKham, idPhieuThuoc },
      {
        $push: {
          returnHistory: { quantity: safeQty, reason: safeReason, shift, returnedBy: userId, returnedAt: new Date() },
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
  try {
    const { idPhieuKham } = req.params;
    const { items } = req.body;
    const userId = req.user?.id;

    const ops = items.map((it) => ({
      updateOne: {
        filter: { idPhieuKham, idPhieuThuoc: it.idPhieuThuoc },
        update: {
          $set: {
            splits: it.splits,
            updatedBy: userId,
            status: "Chờ dùng thuốc",
            splitSource: it.splitSource || "MANUAL",
            confidence: it.confidence ?? 1,
            needsReview: it.needsReview ?? false,
            reason: it.reason ?? null,
            rawInstruction: it.rawInstruction ?? null,
            parsedInstruction: it.parsedInstruction ?? null,
          }
        },
        upsert: true,
      }
    }));

    if (ops.length) {
      await MedShiftSplit.bulkWrite(ops);
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
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

exports.autoSplitAll = async (req, res) => {
  try {
    const { idPhieuKham } = req.params;
    const userId = req.user?.id;
    const { items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Không có dữ liệu đơn thuốc để tự động chia" });
    }

    const existingRows = await MedShiftSplit.find({ idPhieuKham }).lean();
    const existingMap = new Map(existingRows.map((row) => [row.idPhieuThuoc, row]));

    const ops = [];
    let autoSuccess = 0;
    let needsReview = 0;
    let failed = 0;
    let skippedManual = 0;

    for (const med of items) {
      const existing = existingMap.get(String(med.idPhieuThuoc));

      if (existing?.splitSource === "MANUAL") {
        skippedManual++;
        continue;
      }

      const suggestion = suggestSplitFromInstruction({
        lieuDung: med.lieuDung,
        maxQty: med.maxQty,
      });

      const total =
        suggestion.splits.MORNING +
        suggestion.splits.NOON +
        suggestion.splits.AFTERNOON +
        suggestion.splits.NIGHT;

      if (total <= 0) {
        failed++;
      } else if (suggestion.needsReview) {
        needsReview++;
      } else {
        autoSuccess++;
      }

      ops.push({
        updateOne: {
          filter: {
            idPhieuKham,
            idPhieuThuoc: String(med.idPhieuThuoc),
          },
          update: {
            $set: {
              splits: suggestion.splits,
              updatedBy: userId,
              status: "Chờ dùng thuốc",
              splitSource: suggestion.source,
              confidence: suggestion.confidence,
              needsReview: total <= 0 ? true : suggestion.needsReview,
              reason: suggestion.reason,
              rawInstruction: med.lieuDung || null,
              parsedInstruction: suggestion.parsedInstruction,
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length > 0) {
      await MedShiftSplit.bulkWrite(ops);
    }

    return res.json({
      ok: true,
      summary: {
        total: items.length,
        autoSuccess,
        needsReview,
        failed,
        skippedManual,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};