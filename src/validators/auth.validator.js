const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "doctor", "nurse"]),
});

module.exports = {
  loginSchema,
  refreshSchema,
  createUserSchema,
};
