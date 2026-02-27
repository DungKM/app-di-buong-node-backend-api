const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return cors(corsOptions)(req, res, next);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

global._io = io;

io.on("connection", (socket) => {
  socket.on("join_khoa", (idKhoa) => {
    socket.join(idKhoa);
    console.log(`User ${socket.id} đã vào phòng khoa: ${idKhoa}`);
  });
});

const medSplitRoutes = require("./routes/medSplit.routes");
const noteRoutes = require("./routes/note.routes");
const notiRoutes = require("./routes/notification.routes");

app.use("/auth", require("./routes/auth.routes"));
app.use("/api", medSplitRoutes);
app.use("/api", noteRoutes);
app.use("/api", notiRoutes);

module.exports = server;