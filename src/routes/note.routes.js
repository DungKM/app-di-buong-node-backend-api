const router = require("express").Router();
const controller = require("../controllers/note.controller");
const { authRequired } = require("../middlewares/auth.middleware");

router.get("/encounters/:idPhieuKham/notes", authRequired, controller.list);
router.post("/encounters/:idPhieuKham/notes", authRequired, controller.create);

module.exports = router;