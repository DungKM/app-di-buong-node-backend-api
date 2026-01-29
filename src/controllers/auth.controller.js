const bcrypt = require("bcrypt");
const User = require("../models/User");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");

function buildAccessPayload(user) {
  return {
    sub: user._id.toString(),
    username: user.username,
    role: user.role,
    idKhoa: user.idKhoa ?? null,
  };
}

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
    // token rác thì coi như logout xong
    return res.json({ message: "Logged out" });
  }

  const user = await User.findById(decoded.sub);
  if (user) {
    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    await user.save();
  }
  return res.json({ message: "Logged out" });
};

// (tuỳ chọn) admin tạo user
exports.createUser = async (req, res) => {
  const { username, password, role, idKhoa } = req.body;

  const existed = await User.findOne({ username: username.toLowerCase() });
  if (existed) return res.status(409).json({ message: "Username already exists" });

  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash(password, rounds);

  const user = await User.create({
    username: username.toLowerCase(),
    passwordHash,
    role,
    idKhoa: idKhoa ?? null,
  });

  return res.status(201).json({
    id: user._id,
    username: user.username,
    role: user.role,
    idKhoa: user.idKhoa,
  });
};
