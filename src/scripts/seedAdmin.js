require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = "admin@example.com";
  const password = "Admin@123456";
  const role = "admin";

  const existed = await User.findOne({ email });
  if (existed) {
    console.log("Admin already exists:", email);
    process.exit(0);
  }

  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  const passwordHash = await bcrypt.hash(password, rounds);

  await User.create({ email, passwordHash, role });
  console.log("Seeded admin:", { email, password });
  process.exit(0);
})();
