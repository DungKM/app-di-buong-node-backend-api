const express = require("express");
const router = express.Router();

// Controllers
const authController = require("../controllers/auth.controller");
const departmentController = require("../controllers/department.controller");

// Middlewares & Validators
const validate = require("../middlewares/validate.middleware");
const { authRequired, requireRoles } = require("../middlewares/auth.middleware");
const { 
  loginSchema, 
  refreshSchema, 
  createUserSchema, 
  updateUserSchema, 
  updateStatusSchema, 
  resetPasswordSchema 
} = require("../validators/auth.validator");

// --- 1. AUTHENTICATION (Public/Private) ---
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", validate(refreshSchema), authController.logout);

// --- 2. USER MANAGEMENT (Admin Only) ---
router.route("/users")
  .get(authRequired, requireRoles("admin"), authController.listUsers)
  .post(authRequired, requireRoles("admin"), validate(createUserSchema), authController.createUser);

router.route("/users/:id")
  // Đã chuyển thành PATCH để khớp với Frontend
  .patch(authRequired, requireRoles("admin"), validate(updateUserSchema), authController.updateUser);

router.patch("/users/:id/status", 
  authRequired, 
  requireRoles("admin"), 
  validate(updateStatusSchema), 
  authController.updateStatus
);

router.post("/users/:id/reset-password", 
  authRequired, 
  requireRoles("admin"), 
  validate(resetPasswordSchema), 
  authController.resetPassword
);

// --- 3. DEPARTMENT MANAGEMENT (Admin Only) ---
router.route("/departments")
  .get(authRequired, requireRoles("admin"), departmentController.getAllDepartments)
  .post(authRequired, requireRoles("admin"), departmentController.createDepartment);

router.route("/departments/:id")
  .patch(authRequired, requireRoles("admin"), departmentController.updateDepartment)
  .delete(authRequired, requireRoles("admin"), departmentController.deleteDepartment);

module.exports = router;