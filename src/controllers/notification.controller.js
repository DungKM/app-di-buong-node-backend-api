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
    const userId = req.user?.id || req.user?.sub;
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