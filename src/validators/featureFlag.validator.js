const { z } = require("zod");

const createSchema = z.object({
  code: z.string().trim().min(1, "Mã không được để trống").toUpperCase(),
  name: z.string().trim().min(1, "Tên không được để trống"),
  description: z.string().trim().optional().default(""),
  isEnabled: z.boolean().optional().default(false),
  reason: z.string().trim().min(1, "Lý do không được để trống"),
});

const updateSchema = z.object({
  name: z.string().trim().min(1, "Tên không được để trống").optional(),
  description: z.string().trim().optional(),
});

const toggleSchema = z.object({
  isEnabled: z.boolean({ required_error: "Trạng thái bật/tắt không được để trống" }),
  reason: z.string().trim().min(1, "Lý do không được để trống"),
});

module.exports = { createSchema, updateSchema, toggleSchema };
