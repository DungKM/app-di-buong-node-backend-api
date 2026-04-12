const express = require("express");
const router = express.Router();

const medSplitController = require("../controllers/medSplit.controller");
const { authRequired } = require("../middlewares/auth.middleware");

router.get(
  "/encounters/:idPhieuKham/med-splits",
  authRequired,
  medSplitController.list
);

router.post(
  "/encounters/:idPhieuKham/med-splits/auto-split",
  authRequired,
  medSplitController.autoSplitAll
);

router.put(
  "/encounters/:idPhieuKham/med-splits/:idPhieuThuoc",
  authRequired,
  medSplitController.saveOne
);

router.put(
  "/encounters/:idPhieuKham/med-splits",
  authRequired,
  medSplitController.saveBatch
);

router.patch(
  "/encounters/:idPhieuKham/med-splits/:idPhieuThuoc/return",
  authRequired,
  medSplitController.returnMedication
);

router.patch(
  "/encounters/:idPhieuKham/med-splits/:idPhieuThuoc/confirm",
  authRequired,
  medSplitController.confirmUsage
);

router.patch(
  "/encounters/:idPhieuKham/med-splits/confirm-all",
  authRequired,
  medSplitController.confirmAllUsage
);

router.patch(
  "/encounters/:idPhieuKham/med-splits/:idPhieuThuoc/unconfirm",
  authRequired,
  medSplitController.cancelConfirmedUsage
);

module.exports = router;
