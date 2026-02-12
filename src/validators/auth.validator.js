const { z } = require("zod");

const loginSchema = z.object({
  username: z.string().trim().min(1, "Tên đăng nhập không được để trống"),
  password: z.string().min(1, "Mật khẩu không được để trống"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const createUserSchema = z.object({
  username: z.string().trim().min(1, "Username là bắt buộc"),
  password: z.string().min(1, "Mật khẩu không được để trống"), // Đã bỏ giới hạn 6 ký tự theo ý bạn
  role: z.enum(["admin", "doctor", "nurse"]),
  idKhoa: z.string().optional().nullable(), // Cho phép nhận idHis từ Frontend
});

const updateUserSchema = z.object({
  role: z.enum(["admin", "doctor", "nurse"]).optional(),
  idKhoa: z.string().optional().nullable(),
  password: z.string().optional().or(z.literal("")), // Cho phép để trống nếu không muốn đổi mật khẩu
});

const updateStatusSchema = z.object({
  isActive: z.boolean({
    required_error: "Trạng thái isActive là bắt buộc",
  }),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(1, "Vui lòng nhập mật khẩu mới"), // Đã bỏ giới hạn độ dài
});

module.exports = { 
  loginSchema, 
  refreshSchema, 
  createUserSchema,
  updateUserSchema,    
  updateStatusSchema, 
  resetPasswordSchema 
};