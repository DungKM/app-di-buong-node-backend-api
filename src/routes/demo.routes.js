const express = require("express");
const { authRequired, requireRoles } = require("../middlewares/auth");
const router = express.Router();

router.get("/me", authRequired, (req, res) => res.json({ user: req.user }));

router.get("/admin-only", authRequired, requireRoles("admin"), (req, res) => {
  res.json({ message: "Hello admin" });
});

router.get("/clinical", authRequired, requireRoles("admin", "doctor", "nurse"), (req, res) => {
  res.json({ message: "Hello medical staff" });
});

router.post("/prescriptions", authRequired, requireRoles("admin", "doctor"), (req, res) => {
  res.json({ message: "Prescription created" });
});

module.exports = router;
