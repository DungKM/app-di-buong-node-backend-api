const express = require("express");
const router = express.Router();

const medSplitController = require("../controllers/medSplit.controller");
const { authRequired } = require("../middlewares/auth.middleware");

// Load splits theo lần khám
router.get(
  "/encounters/:idPhieuKham/med-splits",
  authRequired,
  medSplitController.list
);

// Save 1 thuốc
router.put(
  "/encounters/:idPhieuKham/med-splits/:idPhieuThuoc",
  authRequired,
  medSplitController.saveOne
);

// Save batch toàn bộ đơn thuốc
router.put(
  "/encounters/:idPhieuKham/med-splits",
  authRequired,
  medSplitController.saveBatch
);

// ✅ Route trả thuốc với số lượng và lý do
router.patch(
  "/encounters/:idPhieuKham/med-splits/:idPhieuThuoc/return",
  authRequired,
  medSplitController.returnMedication
);

// ✅ Route xác nhận dùng thuốc
router.patch(
  "/encounters/:idPhieuKham/med-splits/:idPhieuThuoc/confirm",
  authRequired,
  medSplitController.confirmUsage
);
module.exports = router;
