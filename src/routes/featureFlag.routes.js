const router = require("express").Router();
const ctrl = require("../controllers/featureFlag.controller");
const { authRequired, requireRoles } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { createSchema, updateSchema, toggleSchema } = require("../validators/featureFlag.validator");

// Đọc danh sách / chi tiết — mọi user đã đăng nhập
router.get("/feature-flags", authRequired, ctrl.list);
router.get("/feature-flags/:code", authRequired, ctrl.getByCode);

// Tạo / sửa / bật-tắt / xoá — chỉ admin
router.post("/feature-flags", authRequired, requireRoles("admin"), validate(createSchema), ctrl.create);
router.put("/feature-flags/:code", authRequired, requireRoles("admin"), validate(updateSchema), ctrl.update);
router.patch("/feature-flags/:code/toggle", authRequired, requireRoles("admin"), validate(toggleSchema), ctrl.toggle);
router.delete("/feature-flags/:code", authRequired, requireRoles("admin"), ctrl.remove);

module.exports = router;
