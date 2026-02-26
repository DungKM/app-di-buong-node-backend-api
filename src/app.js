const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Danh sách origin được phép
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// CORS options dùng chung
const corsOptions = {
  origin: (origin, cb) => {
    // Cho phép request không có Origin (curl/postman)
    if (!origin) return cb(null, true);

    // Nếu bạn chưa set CORS_ORIGINS thì tạm cho hết để khỏi lỗi
    if (allowedOrigins.length === 0) return cb(null, true);

    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ✅ CORS phải đặt trước routes
app.use(cors(corsOptions));

// ✅ QUAN TRỌNG: handle preflight OPTIONS để tránh 404
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : true, // nếu chưa set env thì cho hết
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Biến global để gọi io từ mọi nơi trong dự án
global._io = io;

io.on("connection", (socket) => {
  socket.on("join_khoa", (idKhoa) => {
    socket.join(idKhoa);
    console.log(`User ${socket.id} đã vào phòng khoa: ${idKhoa}`);
  });
});

const medSplitRoutes = require("./routes/medSplit.routes");
const noteRoutes = require("./routes/note.routes");

app.use("/auth", require("./routes/auth.routes"));
app.use("/api", medSplitRoutes);
app.use("/api", noteRoutes);

module.exports = server;