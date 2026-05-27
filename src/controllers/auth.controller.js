const bcrypt = require("bcrypt");
const User = require("../models/User");
const Department = require('../models/Department');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const ExcelJS = require('exceljs');

async function buildAccessPayload(user) {
  const dept = user.idKhoa
    ? await Department.findById(user.idKhoa).select("name")
    : null;

  return {
    sub: user._id.toString(),
    username: user.username,
    role: user.role,

    idKhoa: user.idKhoa ?? null,
    tenKhoa: dept?.name ?? null,
  };
}
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Missing username or password" });
  }

  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user || !user.isActive)
    return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok)
    return res.status(401).json({ message: "Invalid credentials" });

  let tenKhoa = null;
  let idHis = null;
  if (user.idKhoa) {
    const dept = await Department.findById(user.idKhoa).select("name idHis");
    tenKhoa = dept?.name ?? null;
    idHis = dept?.idHis ?? null;
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    username: user.username,
    role: user.role,
    idKhoa: user.idKhoa?.toString() ?? null,
    tenKhoa,
    idHis
  });

  const refreshToken = signRefreshToken({ sub: user._id.toString() });

  user.refreshTokens.push(refreshToken);
  await user.save();

  return res.json({
    accessToken,
    refreshToken,
    role: user.role,
    username: user.username,
    name: user.fullName ?? user.username,
    idKhoa: user.idKhoa?.toString() ?? null,
    tenKhoa,
    idHis
  });
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ message: "Invalid/expired refresh token" });
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) return res.status(401).json({ message: "Invalid refresh token" });

  if (!user.refreshTokens.includes(refreshToken)) {
    return res.status(401).json({ message: "Refresh token revoked" });
  }

  const accessToken = signAccessToken(await buildAccessPayload(user));
  return res.json({ accessToken });
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: "Missing refreshToken" });

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return res.json({ message: "Logged out" });
  }

  const user = await User.findById(decoded.sub);
  if (user) {
    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    await user.save();
  }
  return res.json({ message: "Logged out" });
};


exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .populate('idKhoa', 'name idHis')
      .select("-passwordHash -refreshTokens")
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: users });
  } catch (error) {
    console.error("Backend Error at listUsers:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { fullName, username, password, role, idKhoa } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: "Mật khẩu là bắt buộc" });
    }

    let finalIdKhoa = null;
    if (idKhoa) {
      const dept = await Department.findOne({ idHis: idKhoa });
      if (dept) {
        finalIdKhoa = dept._id;
      }
    }

    const passwordHash = await hashPassword(password);

    const newUser = new User({
      fullName,
      username,
      passwordHash,
      role,
      idKhoa: finalIdKhoa
    });

    await newUser.save();
    res.status(201).json({ success: true, data: newUser });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    res.json({ success: true, message: "Cập nhật trạng thái thành công", data: updatedUser });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, idKhoa, password } = req.body;
    const updateData = { fullName, role };
    if (idKhoa) {
      const dept = await Department.findOne({ idHis: idKhoa });
      if (!dept) {
        return res.status(400).json({ success: false, message: "Mã Khoa/Phòng không tồn tại" });
      }
      updateData.idKhoa = dept._id;
    } else {
      updateData.idKhoa = null;
    }

    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate("idKhoa");

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng"
      });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordHash = passwordHash;
    user.refreshTokens = [];
    await user.save();

    res.json({
      success: true,
      message: "Mật khẩu đã được đặt lại thành công"
    });

  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.importUsers = async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách users không hợp lệ" });
    }

    // Lấy danh sách idKhoa (có thể là idHis GUID hoặc ObjectId)
    const idKhoaValues = [...new Set(users.map(u => (u.idKhoa || "").toString().trim()).filter(Boolean))];

    // Map nhanh idHis -> _id
    const depts = await Department.find({ idHis: { $in: idKhoaValues } }).select("_id idHis");
    const mapIdHisToObjectId = new Map(depts.map(d => [String(d.idHis).toUpperCase(), d._id]));

    const ops = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      const u = users[i] || {};
      const username = String(u.username || "").trim().toLowerCase();
      const role = String(u.role || "nurse").trim().toLowerCase();

      if (!username) {
        errors.push({ row: i + 2, message: "Thiếu username" });
        continue;
      }

      if (!["admin", "doctor", "nurse"].includes(role)) {
        errors.push({ row: i + 2, username, message: `Role không hợp lệ: ${role}` });
        continue;
      }

      // password mặc định admin123 nếu không gửi
      const rawPassword = String(u.password || "admin123");
      const passwordHash = await hashPassword(rawPassword);

      // isActive mặc định true
      const isActive = u.isActive === false ? false : true;

      // idKhoa: ưu tiên map theo idHis GUID (đang dùng sẵn trong codebase)
      // Nếu muốn cho phép truyền ObjectId thẳng thì sẽ xử lý thêm ở dưới
      let finalIdKhoa = null;
      const idKhoa = (u.idKhoa || "").toString().trim();
      if (idKhoa) {
        const key = idKhoa.toUpperCase();
        if (mapIdHisToObjectId.has(key)) {
          finalIdKhoa = mapIdHisToObjectId.get(key);
        } else {
          // Nếu excel đang truyền ObjectId (24 hex) thì cho set thẳng
          // (không bắt buộc, nhưng giúp bạn linh hoạt)
          const mongoose = require("mongoose");
          if (mongoose.Types.ObjectId.isValid(idKhoa)) {
            finalIdKhoa = idKhoa;
          } else {
            // Không tìm thấy khoa theo idHis
            errors.push({ row: i + 2, username, message: `Không tìm thấy khoa theo idKhoa/idHis: ${idKhoa}` });
            continue;
          }
        }
      }

      ops.push({
        updateOne: {
          filter: { username },
          update: {
            $set: { role, idKhoa: finalIdKhoa, isActive },
            // chỉ set password khi tạo mới (tránh reset pass khi import lại)
            $setOnInsert: { passwordHash }
          },
          upsert: true
        }
      });
    }

    if (ops.length === 0) {
      return res.status(400).json({ success: false, message: "Không có dòng hợp lệ để import", errors });
    }

    const result = await User.bulkWrite(ops, { ordered: false });

    return res.json({
      success: true,
      message: "Import thành công",
      data: {
        inserted: result.upsertedCount || 0,
        updated: result.modifiedCount || 0
      },
      errors
    });
  } catch (error) {
    console.error("Import Users Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadUsersImportTemplate = async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('NguoiDung');

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    const centerAlign = { horizontal: 'center', vertical: 'middle' };
    const border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };

    ws.columns = [
      { header: 'username (*)', key: 'username', width: 22 },
      { header: 'password',     key: 'password', width: 20 },
      { header: 'role',         key: 'role',     width: 12 },
      { header: 'idKhoa',       key: 'idKhoa',   width: 38 },
      { header: 'isActive',     key: 'isActive', width: 12 },
    ];

    ws.getRow(1).eachCell(cell => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = centerAlign;
      cell.border = border;
    });
    ws.getRow(1).height = 22;

    const samples = [
      { username: 'nguyen.van.a', password: 'admin123', role: 'nurse',  idKhoa: 'KH001', isActive: true },
      { username: 'tran.thi.b',   password: 'admin123', role: 'doctor', idKhoa: 'KH002', isActive: true },
      { username: 'le.van.c',     password: '',         role: 'admin',  idKhoa: '',      isActive: true },
      { username: 'pham.thi.d',   password: '',         role: 'nurse',  idKhoa: '',      isActive: false },
    ];

    const dataFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FF' } };

    samples.forEach(row => {
      const r = ws.addRow(row);
      r.eachCell({ includeEmpty: true }, cell => {
        cell.fill = dataFill;
        cell.font = { size: 11 };
        cell.border = border;
        cell.alignment = { vertical: 'middle' };
      });
      r.height = 20;
    });

    // Dropdown cho cột role
    ws.getColumn('role').eachCell({ includeEmpty: true }, (cell, rowNum) => {
      if (rowNum === 1) return;
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"admin,doctor,nurse"'],
        showErrorMessage: true,
        errorTitle: 'Giá trị không hợp lệ',
        error: 'Chọn một trong: admin, doctor, nurse',
      };
    });

    // Dropdown cho cột isActive
    ws.getColumn('isActive').eachCell({ includeEmpty: true }, (cell, rowNum) => {
      if (rowNum === 1) return;
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"true,false"'],
        showErrorMessage: true,
        errorTitle: 'Giá trị không hợp lệ',
        error: 'Chọn true hoặc false',
      };
    });

    // Sheet hướng dẫn
    const wsNote = wb.addWorksheet('Hướng dẫn');
    wsNote.getColumn(1).width = 72;
    const notes = [
      ['HƯỚNG DẪN IMPORT NGƯỜI DÙNG'],
      [''],
      ['Cột bắt buộc:'],
      ['  username  - Tên đăng nhập (duy nhất, viết thường)'],
      [''],
      ['Cột tùy chọn:'],
      ['  password  - Mật khẩu (để trống dùng mặc định admin123, không reset nếu đã tồn tại)'],
      ['  role      - Quyền: admin | doctor | nurse  (mặc định: nurse)'],
      ['  idKhoa    - idHis của Khoa (tra trong file mẫu khoa/phòng), hoặc ObjectId MongoDB'],
      ['  isActive  - true | false  (mặc định: true)'],
      [''],
      ['Lưu ý:'],
      ['  - Upsert theo username: đã tồn tại thì cập nhật, chưa có thì tạo mới'],
      ['  - Password chỉ set khi tạo mới, KHÔNG bị reset khi import lại'],
      ['  - idKhoa để trống nếu user không thuộc khoa nào'],
    ];
    notes.forEach((row, i) => {
      const r = wsNote.addRow(row);
      if (i === 0) r.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1F4E79' } };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="mau_import_nguoi_dung.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Download Users Template Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
