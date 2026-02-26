require("dotenv").config();
const mongoose = require("mongoose");
const server = require("./app"); // ✅ app.js export server rồi

const PORT = process.env.PORT || 3000;

async function main() {
  console.log("MONGO_URI =", process.env.MONGO_URI);

  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI in .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected");

  server.listen(PORT, () => {
    console.log(`🚀 [SOCKET.IO] Server đang lắng nghe tại cổng ${PORT}`);
    console.log(`🌐 [CORS] Cho phép các nguồn: ${process.env.CORS_ORIGINS}`);
  });
}

main().catch((err) => {
  console.error("Server failed:", err);
  process.exit(1);
});