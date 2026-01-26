const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const validate = require("../middlewares/validate.middleware"); 
const { loginSchema, refreshSchema, createUserSchema } = require("../validators/auth.validator");
const { authRequired, requireRoles } = require("../middlewares/auth.middleware");

router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", validate(refreshSchema), authController.logout);

router.post("/users",
  authRequired,
  requireRoles("admin"),
  validate(createUserSchema),
  authController.createUser
);

module.exports = router;