const bcrypt = require("bcrypt");
const User = require("../models/User");
const Department = require('../models/Department');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");

function buildAccessPayload(user) {
  return {
    sub: user._id.toString(),
    username: user.username,
    role: user.role,
    idKhoa: user.idKhoa ?? null,
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
  if (!user || !user.isActive) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const accessToken = signAccessToken(buildAccessPayload(user));
  const refreshToken = signRefreshToken({ sub: user._id.toString() });

  user.refreshTokens.push(refreshToken);
  await user.save();

  return res.json({ accessToken, refreshToken, role: user.role });
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

  const accessToken = signAccessToken(buildAccessPayload(user));
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
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await user.update({ passwordHash });
    if (user.refreshTokens) {
      await user.update({ refreshTokens: [] });
    }
    res.json({ success: true, message: "Mật khẩu đã được đặt lại thành công" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
