const Khoa = require("../models/Khoa");

// GET /khoa
exports.list = async (req, res) => {
  const data = await Khoa.find().sort({ tenKhoa: 1 });
  return res.json(data);
};

// POST /khoa
exports.create = async (req, res) => {
  const { idKhoa, tenKhoa, maKhoa } = req.body;

  const existedId = await Khoa.findOne({ idKhoa: idKhoa.trim() });
  if (existedId) return res.status(409).json({ message: "idKhoa already exists" });

  const existedName = await Khoa.findOne({ tenKhoa: tenKhoa.trim() });
  if (existedName) return res.status(409).json({ message: "tenKhoa already exists" });

  const created = await Khoa.create({
    idKhoa: idKhoa.trim(),
    tenKhoa: tenKhoa.trim(),
    maKhoa: maKhoa ?? null,
  });

  return res.status(201).json(created);
};

// PUT /khoa/:idKhoa  (sửa theo idKhoa)
exports.update = async (req, res) => {
  const { idKhoa } = req.params;
  const { tenKhoa, maKhoa, isActive } = req.body;

  const khoa = await Khoa.findOne({ idKhoa });
  if (!khoa) return res.status(404).json({ message: "Khoa not found" });

  // nếu đổi tên khoa -> check unique
  if (tenKhoa && tenKhoa.trim() !== khoa.tenKhoa) {
    const existedName = await Khoa.findOne({ tenKhoa: tenKhoa.trim() });
    if (existedName) return res.status(409).json({ message: "tenKhoa already exists" });
    khoa.tenKhoa = tenKhoa.trim();
  }

  if (maKhoa !== undefined) khoa.maKhoa = maKhoa ?? null;
  if (isActive !== undefined) khoa.isActive = isActive;

  await khoa.save();
  return res.json(khoa);
};

// DELETE /khoa/:idKhoa  (soft delete)
exports.remove = async (req, res) => {
  const { idKhoa } = req.params;

  const khoa = await Khoa.findOne({ idKhoa });
  if (!khoa) return res.status(404).json({ message: "Khoa not found" });

  khoa.isActive = false;
  await khoa.save();

  return res.json({ message: "Khoa deactivated", idKhoa });
};
