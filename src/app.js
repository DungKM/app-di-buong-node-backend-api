const express = require("express");
const cors = require("cors");
const http = require("http"); // 1. Thêm http
const { Server } = require("socket.io"); // 2. Thêm Socket.io

const app = express();
const server = http.createServer(app); // 3. Bọc app vào server

// Cấu hình Socket.io
const io = new Server(server, {
  cors: {
    origin: (process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()),
    credentials: true
  }
});

// Biến global để gọi io từ mọi nơi trong dự án
global._io = io;

const medSplitRoutes = require("./routes/medSplit.routes");
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

io.on("connection", (socket) => {
  socket.on("join_khoa", (idKhoa) => {
    socket.join(idKhoa);
    console.log(`User ${socket.id} đã vào phòng khoa: ${idKhoa}`);
  });
});

app.use("/auth", require("./routes/auth.routes"));
app.use("/api", medSplitRoutes);

module.exports = server;