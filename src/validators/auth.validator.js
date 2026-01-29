const { z } = require("zod");

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(["admin", "doctor", "nurse"]),
  idKhoa: z.string().min(1).optional().nullable(), // ✅ thêm
});

module.exports = { loginSchema, refreshSchema, createUserSchema };
