require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const username = "admin";
  const password = "Admin@123456";
  const role = "admin";
  const idKhoa = null; // hoặc "BA-000001"

  const existed = await User.findOne({ username: username.toLowerCase() });
  if (existed) {
    console.log("Admin already exists:", username);
    process.exit(0);
  }

  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash(password, rounds);

  await User.create({
    username: username.toLowerCase(),
    passwordHash,
    role,
    idKhoa,
    isActive: true,
    refreshTokens: [],
  });

  console.log("Seeded admin:", { username, password });
  process.exit(0);
})();


// Doctor@123456