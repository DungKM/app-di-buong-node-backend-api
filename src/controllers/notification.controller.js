const Notification = require("../models/Notification");

exports.list = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    const idKhoa = req.user?.idKhoa?.toString?.() || req.user?.idKhoa;

    if (!idKhoa) return res.json({ data: [], unreadCount: 0 });

    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

    const rows = await Notification.find({ idKhoa })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const data = rows.map((n) => ({
      ...n,
      read: userId ? n.readBy?.some((x) => x.toString() === userId.toString()) : false,
    }));

    const unreadCount = data.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);

    return res.json({ data, unreadCount });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.clearAll = async (req, res) => {
  try {
    const idKhoa = req.user?.idKhoa?.toString?.() || req.user?.idKhoa;

    if (!idKhoa) return res.json({ success: true, deleted: 0 });

    const result = await Notification.deleteMany({ idKhoa });

    return res.json({ success: true, deleted: result.deletedCount });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    const { id } = req.params;

    await Notification.updateOne(
      { _id: id },
      { $addToSet: { readBy: userId } }
    );

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.sub;
    const idKhoa = req.user?.idKhoa?.toString?.() || req.user?.idKhoa;

    if (!idKhoa) return res.json({ success: true });

    await Notification.updateMany(
      { idKhoa, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.getReturnsByDate = async (req, res) => {
  try {
    const idKhoa = req.user?.idKhoa?.toString?.() || req.user?.idKhoa;
    const date = req.query.date;

    if (!idKhoa) {
      return res.json({
        date: date || null,
        summary: { totalPatients: 0, totalReturns: 0, totalQty: 0 },
        patients: [],
      });
    }

    if (!date) {
      return res.status(400).json({ message: "Thiếu tham số date" });
    }

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const rows = await Notification.find({
      idKhoa,
      type: "RETURN",
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .lean();

    const patientMap = new Map();

    for (const row of rows) {
      const payload = row.payload || {};
      const maBenhNhan = payload.maBenhNhan || "N/A";
      const tenBenhNhan = payload.tenBenhNhan || "Bệnh nhân";
      const key = `${maBenhNhan}__${tenBenhNhan}`;

      if (!patientMap.has(key)) {
        patientMap.set(key, {
          maBenhNhan,
          tenBenhNhan,
          lastReturnedAt: row.createdAt,
          returnCount: 0,
          items: [],
        });
      }

      const patient = patientMap.get(key);
      patient.returnCount += 1;

      if (!patient.lastReturnedAt || new Date(row.createdAt) > new Date(patient.lastReturnedAt)) {
        patient.lastReturnedAt = row.createdAt;
      }

      patient.items.push({
        id: row._id,
        idPhieuKham: payload.idPhieuKham || null,
        idPhieuThuoc: payload.idPhieuThuoc || null,
        tenThuoc: payload.tenThuoc || "Thuốc",
        quantity: Number(payload.soLuongTra || 0),
        reason: payload.reason || "",
        returnedAt: row.createdAt,
        url: payload.url || null,
      });
    }

    const patients = Array.from(patientMap.values()).sort(
      (a, b) => new Date(b.lastReturnedAt) - new Date(a.lastReturnedAt)
    );

    const totalQty = patients.reduce(
      (sum, p) => sum + p.items.reduce((s, i) => s + Number(i.quantity || 0), 0),
      0
    );

    return res.json({
      date,
      summary: {
        totalPatients: patients.length,
        totalReturns: rows.length,
        totalQty,
      },
      patients,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};