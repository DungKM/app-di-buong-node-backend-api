const router = require("express").Router();
const noti = require("../controllers/notification.controller");
const { authRequired } = require("../middlewares/auth.middleware");

router.get("/notifications", authRequired, noti.list);
router.patch("/notifications/:id/read", authRequired, noti.markRead);
router.patch("/notifications/read-all", authRequired, noti.markAllRead);
router.delete("/notifications", authRequired, noti.clearAll);

module.exports = router;