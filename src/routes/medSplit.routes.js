const express = require("express");
const router = express.Router();

const medSplitController = require("../controllers/medSplit.controller");
const { authRequired } = require("../middlewares/auth.middleware");

router.get(
  "/encounters/:idPhieuKham/med-splits",
  authRequired,
  medSplitController.list
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
module.exports = router;
