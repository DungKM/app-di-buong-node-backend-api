const { z } = require("zod");

const createKhoaSchema = z.object({
  idKhoa: z.string().min(1),     // ✅ thêm bắt buộc
  tenKhoa: z.string().min(2),
  maKhoa: z.string().optional().nullable(),
});

const updateKhoaSchema = z.object({
  tenKhoa: z.string().min(2).optional(),
  maKhoa: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

module.exports = { createKhoaSchema, updateKhoaSchema };
